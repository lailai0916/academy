from pathlib import Path
import subprocess
import tempfile
import unittest

from release_retention import prune_releases


class ReleaseRetentionTest(unittest.TestCase):
    def releases(self, root, count=10):
        releases = root / "releases"
        releases.mkdir()
        paths = []
        for day in range(1, count + 1):
            path = releases / f"202610{day:02d}T120000Z"
            path.mkdir()
            paths.append(path)
        (root / "current").symlink_to(paths[-1])
        return paths

    def test_keeps_latest_five_and_older_current_previous_and_compose_references(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = self.releases(root)
            (root / "current").unlink()
            (root / "current").symlink_to(paths[0])
            (root / "previous").symlink_to(paths[1])
            refs = lambda: [str(paths[2] / "deployment/docker-compose.yml")]
            removed = prune_releases(root, refs)
            self.assertEqual(set(removed), {paths[3].name, paths[4].name})
            self.assertTrue(all(path.is_dir() for path in paths[:3] + paths[5:]))

    def test_does_not_touch_unknown_directories_or_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = self.releases(root, 6)
            unknown = root / "releases/manual-archive"
            unknown.mkdir()
            link = root / "releases/20260901T120000Z"
            link.symlink_to(paths[-1])
            self.assertEqual(prune_releases(root, lambda: []), [paths[0].name])
            self.assertTrue(unknown.is_dir())
            self.assertTrue(link.is_symlink())

    def test_unavailable_container_metadata_leaves_releases_untouched(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = self.releases(root, 6)
            def unavailable():
                raise subprocess.CalledProcessError(1, "docker")
            with self.assertRaises(subprocess.CalledProcessError):
                prune_releases(root, unavailable)
            self.assertTrue(all(path.is_dir() for path in paths))

    def test_rechecks_container_references_before_each_removal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = self.releases(root, 7)
            calls = []
            def references():
                calls.append(None)
                return [str(paths[0])] if len(calls) == 2 else []
            removed = prune_releases(root, references)
            self.assertEqual(removed, [paths[1].name])
            self.assertTrue(paths[0].is_dir())
            self.assertEqual(len(calls), 2)

    def test_dry_run_and_invalid_current_pointer_do_not_remove_anything(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = self.releases(root, 6)
            self.assertEqual(prune_releases(root, lambda: [], dry_run=True), [paths[0].name])
            self.assertTrue(paths[0].is_dir())
            (root / "current").unlink()
            (root / "current").symlink_to(root)
            with self.assertRaises(ValueError):
                prune_releases(root, lambda: [])
            self.assertTrue(all(path.is_dir() for path in paths))


if __name__ == "__main__":
    unittest.main()
