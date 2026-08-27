import { Button, Panel, Progress } from '@lailai/ui';
import type { ActiveLearningSession } from '@lailai/academy-shared';
import { formatSessionTime, learningKindLabels, sessionModeLabels } from '../lib/learning';
import { Icon } from './Icon';
import styles from './ActiveSessionCard.module.css';

export function ActiveSessionCard({
  session,
  onResume,
}: {
  session: ActiveLearningSession;
  onResume: () => void;
}) {
  const progress = Math.round((session.completedCount / session.plannedCount) * 100);

  return (
    <Panel feature>
      <div className={styles.body}>
        <span className={styles.icon} aria-hidden="true">
          <Icon icon={session.kind === 'word' ? 'lucide:languages' : 'lucide:feather'} />
        </span>
        <div className={styles.copy}>
          <p>进行中的任务</p>
          <h2>{learningKindLabels[session.kind]}</h2>
          <span>
            {sessionModeLabels[session.mode]} · 开始于{' '}
            <time dateTime={session.startedAt}>{formatSessionTime(session.startedAt)}</time>
          </span>
        </div>
        <div className={styles.progress}>
          <Progress
            label={`${session.completedCount} / ${session.plannedCount} 项`}
            value={progress}
          />
        </div>
        <Button onClick={onResume}>
          继续学习
          <Icon icon="lucide:arrow-right" />
        </Button>
      </div>
    </Panel>
  );
}
