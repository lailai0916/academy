import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unittest


@unittest.skipUnless(sys.platform == "linux" and shutil.which("flock"), "Requires Linux flock")
class BackupDeploymentTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.academy = self.root / "academy"
        self.backups = self.root / "backups"
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.incoming = self.academy / "incoming"
        for name in ["package-lock.json", "deployment/Dockerfile.api",
                     "deployment/docker-compose.yml", "apps/web/dist/index.html"]:
            path = self.incoming / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("fixture")
        (self.academy / ".env").write_text("fixture")
        self.previous = self.academy / "releases/20261001T000000Z"
        (self.previous / "deployment").mkdir(parents=True)
        (self.previous / "deployment/docker-compose.yml").write_text("fixture")
        (self.academy / "current").symlink_to(self.previous)
        self.environment = os.environ | {
            "PATH": str(self.bin) + os.pathsep + os.environ["PATH"],
            "FIXTURE_ROOT": str(self.root),
        }
        for source, target in [("backup-academy.sh", "backup-academy"),
                               ("deploy-academy.sh", "deploy-academy")]:
            script = (Path(__file__).parent / source).read_text()
            for old, new in [
                ("/opt/academy", str(self.academy)),
                ("/var/backups/academy", str(self.backups)),
                ("/var/lock/academy-", str(self.root / "academy-")),
                ("/usr/local/sbin/backup-academy", str(self.bin / "backup-academy")),
                ("/var/www/academy.lailai.one", str(self.root / "public")),
            ]:
                script = script.replace(old, new)
            (self.bin / target).write_text(script)
            (self.bin / target).chmod(0o755)
        self.write_command("date", "print('20261101T120000Z')")
        self.write_command("docker", '''
import json, os, pathlib, sys, time
root = pathlib.Path(os.environ['FIXTURE_ROOT'])
args = sys.argv[1:]
with (root / 'calls.jsonl').open('a') as stream:
    stream.write(json.dumps(args) + '\\n')
if 'pg_dump' in ' '.join(args):
    active = root / 'dump-active'
    fd = os.open(active, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    try:
        time.sleep(float(os.environ.get('DUMP_DELAY', '0')))
        sys.stdout.write('fixture dump')
        sys.exit(int(os.environ.get('DUMP_EXIT', '0')))
    finally:
        active.unlink()
if 'pg_restore' in args:
    sys.stdin.buffer.read()
    sys.exit(int(os.environ.get('RESTORE_EXIT', '0')))
if args[0] == 'build':
    sys.exit(int(os.environ.get('BUILD_EXIT', '0')))
if 'up' in args and os.environ.get('UP_FAIL') == '1':
    sys.exit(0 if os.environ.get('ACADEMY_RELEASE') == '20261001T000000Z' else 1)
''')

    def write_command(self, name, body):
        path = self.bin / name
        path.write_text(f"#!{sys.executable}\n" + body + "\n")
        path.chmod(0o755)

    def run_script(self, name, **environment):
        return subprocess.run([str(self.bin / name)], env=self.environment | environment,
                              capture_output=True, text=True, timeout=10)

    def calls(self):
        path = self.root / "calls.jsonl"
        return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []

    def test_failed_or_invalid_dump_never_publishes_and_cleans_partial(self):
        for environment in [{"DUMP_EXIT": "7"}, {"RESTORE_EXIT": "8"}]:
            with self.subTest(environment=environment):
                result = self.run_script("backup-academy", **environment)
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertEqual(list(self.backups.glob("academy-*")), [])

    def test_concurrent_same_second_backups_are_serialized_and_unique(self):
        first = subprocess.Popen([str(self.bin / "backup-academy")],
                                 env=self.environment | {"DUMP_DELAY": "0.2"},
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        second = subprocess.Popen([str(self.bin / "backup-academy")],
                                  env=self.environment | {"DUMP_DELAY": "0.2"},
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        for process in [first, second]:
            output, error = process.communicate(timeout=10)
            self.assertEqual(process.returncode, 0, (output, error))
        self.assertEqual(len(list(self.backups.glob("*.dump"))), 2)
        self.assertEqual(list(self.backups.glob("*.partial")), [])
        self.assertEqual(["pg_restore" in args for args in self.calls()], [False, True, False, True])
        self.assertTrue(all(path.stat().st_mode & 0o077 == 0 for path in self.backups.glob("*.dump")))

    def test_termination_cleans_its_partial(self):
        process = subprocess.Popen([str(self.bin / "backup-academy")],
                                   env=self.environment | {"DUMP_DELAY": "0.3"},
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        for _ in range(100):
            if (self.root / "dump-active").exists():
                break
            time.sleep(0.01)
        self.assertTrue((self.root / "dump-active").exists())
        process.send_signal(signal.SIGTERM)
        process.communicate(timeout=10)
        self.assertNotEqual(process.returncode, 0)
        self.assertEqual(list(self.backups.glob("academy-*")), [])

    def test_backup_failure_stops_activation_and_removes_only_preparation(self):
        result = self.run_script("deploy-academy", DUMP_EXIT="7")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("stopped before activation", result.stderr)
        self.assertEqual((self.academy / "current").resolve(), self.previous)
        self.assertEqual(list((self.academy / "releases").iterdir()), [self.previous])
        self.assertFalse(any("up" in args for args in self.calls()))
        self.assertIn(["image", "rm", "--no-prune", "academy-api:20261101T120000Z"], self.calls())

    def test_build_failure_removes_partial_release_without_touching_images(self):
        result = self.run_script("deploy-academy", BUILD_EXIT="9")
        self.assertEqual(result.returncode, 9)
        self.assertEqual(list((self.academy / "releases").iterdir()), [self.previous])
        self.assertEqual(len(self.calls()), 1)
        self.assertEqual((self.academy / "current").resolve(), self.previous)

    def test_preexisting_release_is_never_removed_on_timestamp_collision(self):
        collision = self.academy / "releases/20261101T120000Z"
        collision.mkdir()
        result = self.run_script("deploy-academy")
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(collision.is_dir())
        self.assertEqual(self.calls(), [])

    def test_activation_failure_preserves_failed_release_and_restores_previous(self):
        result = self.run_script("deploy-academy", UP_FAIL="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((self.academy / "releases/20261101T120000Z").is_dir())
        self.assertEqual((self.academy / "current").resolve(), self.previous)
        self.assertEqual(len(list(self.backups.glob("*.dump"))), 1)
        self.assertFalse(any(args[:2] == ["image", "rm"] for args in self.calls()))


if __name__ == "__main__":
    unittest.main()
