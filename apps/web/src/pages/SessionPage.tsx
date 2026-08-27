import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Button, IconButton, Panel, Progress } from '@lailai/ui';
import { useNavigate, useParams } from 'react-router';
import type {
  LearningAnswerResult,
  LearningPrompt,
  LearningSessionSummary,
} from '@lailai/academy-shared';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import {
  formatNextReview,
  promptTypeLabels,
  ratingLabels,
  sessionModeLabels,
} from '../lib/learning';
import page from './Page.module.css';
import styles from './SessionPage.module.css';

type AiResponse = {
  summary: string;
  keyPoints: string[];
  practice: { question: string; answer: string };
};

export function SessionPage() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const exitDialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedAt = useRef(Date.now());
  const [prompt, setPrompt] = useState<LearningPrompt | null>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<LearningAnswerResult | null>(null);
  const [summary, setSummary] = useState<LearningSessionSummary | null>(null);
  const [aiResponse, setAiResponse] = useState<AiResponse | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [exitError, setExitError] = useState('');

  const loadNext = useCallback(async () => {
    setLoadingNext(true);
    setError('');
    setAnswer('');
    setResult(null);
    setAiResponse(null);
    try {
      const response = await api<{
        prompt: LearningPrompt | null;
        summary: LearningSessionSummary | null;
      }>(`/learn/sessions/${sessionId}/next`);
      if (!response.prompt && response.summary) {
        setSummary(response.summary);
        setPrompt(null);
        return;
      }
      setPrompt(response.prompt);
      startedAt.current = Date.now();
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      setLoadingNext(false);
    }
  }, [sessionId]);

  const loadSummary = useCallback(async () => {
    setError('');
    const response = await api<{ summary: LearningSessionSummary }>(
      `/learn/sessions/${sessionId}/summary`
    );
    setSummary(response.summary);
    setPrompt(null);
  }, [sessionId]);

  useEffect(() => {
    loadNext().catch((nextError) => setError(errorMessage(nextError)));
  }, [loadNext]);

  const submitAnswer = async (value: string, revealed = false) => {
    if (!prompt || submitting) {
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await api<{ result: LearningAnswerResult }>(
        `/learn/sessions/${sessionId}/answer`,
        {
          method: 'POST',
          body: JSON.stringify({
            contentId: prompt.contentId,
            answer: value,
            responseMs: Date.now() - startedAt.current,
            revealed,
          }),
        }
      );
      setAnswer(value);
      setResult(response.result);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    if (answer.trim()) {
      void submitAnswer(answer);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && event.nativeEvent.isComposing) {
      event.preventDefault();
    }
  };

  const askAi = async () => {
    if (!prompt || !result || aiLoading) {
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const response = await api<{ response: AiResponse }>('/ai/explain', {
        method: 'POST',
        body: JSON.stringify({
          contentId: prompt.contentId,
          sessionId,
          previousAnswer: answer,
          prompt: result.correct ? '生成一道更难的变式题' : '解释错误并生成同知识点变式题',
        }),
      });
      setAiResponse(response.response);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setAiLoading(false);
    }
  };

  const continueLearning = useCallback(() => {
    if (!result || loadingNext) return;
    if (result.sessionComplete) {
      void loadSummary();
    } else {
      void loadNext();
    }
  }, [loadNext, loadSummary, loadingNext, result]);

  useEffect(() => {
    const ownerDocument = inputRef.current?.ownerDocument ?? document;
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('button, input, textarea, select, summary, [contenteditable="true"]')
      ) {
        return;
      }
      if (!result && prompt?.options && /^[1-4]$/.test(event.key)) {
        const option = prompt.options[Number(event.key) - 1];
        if (!option || submitting) return;
        event.preventDefault();
        void submitAnswer(option);
        return;
      }
      if (result && event.key === 'Enter') {
        event.preventDefault();
        continueLearning();
      }
    };
    ownerDocument.addEventListener('keydown', handleShortcut);
    return () => ownerDocument.removeEventListener('keydown', handleShortcut);
  }, [continueLearning, prompt, result, submitting]);

  const openExitDialog = () => {
    setExitError('');
    exitDialogRef.current?.showModal();
  };

  const closeExitDialog = () => {
    exitDialogRef.current?.close();
  };

  const pauseSession = () => {
    exitDialogRef.current?.close();
    navigate('/learn');
  };

  const abandonSession = async () => {
    if (ending) return;
    setEnding(true);
    setExitError('');
    try {
      await api(`/learn/sessions/${sessionId}/abandon`, { method: 'POST' });
      exitDialogRef.current?.close();
      navigate('/learn');
    } catch (nextError) {
      setExitError(errorMessage(nextError));
      setEnding(false);
    }
  };

  if (summary) {
    const completed = summary.status === 'completed';
    const summaryProgress = Math.round((summary.completedCount / summary.plannedCount) * 100);
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <IconButton label="返回学习中心" onClick={() => navigate('/learn')}>
            <Icon icon="lucide:x" />
          </IconButton>
          <Progress label="本组进度" value={summaryProgress} showValue={false} />
          <span>
            {summary.completedCount} / {summary.plannedCount}
          </span>
        </header>
        <div className={styles.stage}>
          <Panel feature>
            <div className={styles.summary}>
              <span className={`${styles.summaryIcon} ${completed ? '' : styles.summaryIconEnded}`}>
                <Icon icon={completed ? 'lucide:check-circle-2' : 'lucide:circle-stop'} />
              </span>
              <div className={styles.summaryTitle}>
                <p>{sessionModeLabels[summary.mode]}</p>
                <h1>{completed ? '本组学习结果' : '本组已结束'}</h1>
                <span>{new Date(summary.startedAt).toLocaleString('zh-CN')}</span>
              </div>
              <div className={styles.summaryMetrics}>
                <article>
                  <span>首轮正确率</span>
                  <strong>{summary.firstPassAccuracy}%</strong>
                </article>
                <article>
                  <span>当前掌握度</span>
                  <strong>{summary.averageMastery}%</strong>
                </article>
                <article>
                  <span>平均反应</span>
                  <strong>{Math.round(summary.averageResponseMs / 100) / 10} 秒</strong>
                </article>
              </div>
              {summary.delayedAccuracy !== null && (
                <p className={styles.delayedResult}>
                  本组延迟测试正确率为 {summary.delayedAccuracy}%。
                </p>
              )}
              {summary.reinforcementCount > 0 && (
                <p className={styles.reinforcementResult}>
                  本组回练 {summary.reinforcementCount} 项，其中 {summary.recoveredCount} 项已纠正。
                </p>
              )}
              <div className={page.actions}>
                <Button
                  onClick={() =>
                    navigate(
                      completed
                        ? '/learn'
                        : summary.kind === 'word'
                          ? '/learn/words'
                          : '/learn/poems'
                    )
                  }
                >
                  {completed ? '返回学习中心' : '开始新任务'}
                </Button>
                {summary.mistakes.length > 0 && (
                  <Button variant="secondary" onClick={() => navigate('/learn/mistakes')}>
                    <Icon icon="lucide:notebook-tabs" />
                    查看本组错题
                  </Button>
                )}
                <Button variant="quiet" onClick={() => navigate('/progress')}>
                  查看学习分析
                  <Icon icon="lucide:arrow-right" />
                </Button>
              </div>
            </div>
          </Panel>

          {summary.mistakes.length > 0 && (
            <Panel>
              <div className={styles.summaryMistakes}>
                <h2>需要巩固</h2>
                {summary.mistakes.map((mistake) => (
                  <article key={mistake.contentId}>
                    <span>
                      <Icon
                        icon={mistake.kind === 'word' ? 'lucide:languages' : 'lucide:feather'}
                      />
                    </span>
                    <div>
                      <strong>{mistake.title}</strong>
                      <small>
                        {mistake.detail} · {mistake.unit}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    );
  }

  if (error && !prompt) {
    return (
      <div className={styles.centerState}>
        <p className={page.error}>{error}</p>
        <Button variant="secondary" onClick={() => navigate('/learn')}>
          返回学习中心
        </Button>
      </div>
    );
  }
  if (!prompt) {
    return <div className={styles.centerState}>正在准备下一题……</div>;
  }

  const sessionTotal = result?.sessionTotal ?? prompt.progress.total;
  const completedItems = prompt.progress.completed + (result ? 1 : 0);
  const progress = Math.round((completedItems / sessionTotal) * 100);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <IconButton label="退出当前任务" onClick={openExitDialog}>
          <Icon icon="lucide:x" />
        </IconButton>
        <Progress label="本组进度" value={progress} showValue={false} />
        <span>
          {completedItems} / {sessionTotal}
        </span>
      </header>

      <div className={styles.stage}>
        <Panel feature className={styles.questionPanel}>
          <div className={styles.question}>
            <div className={styles.questionMeta}>
              <span>{prompt.kind === 'word' ? '英语词汇' : '古诗词'}</span>
              <span>
                {promptTypeLabels[prompt.promptType]}
                {prompt.options ? ' · 1–4 键选择' : ''}
              </span>
            </div>
            <div className={styles.questionCopy}>
              <p>{prompt.context}</p>
              <h1>{prompt.title}</h1>
              <div className={styles.prompt}>{prompt.prompt}</div>
            </div>

            {!result && (
              <div className={styles.answerArea}>
                {prompt.options ? (
                  <div className={styles.options}>
                    {prompt.options.map((option, index) => (
                      <button
                        key={`${index}-${option}`}
                        type="button"
                        aria-keyshortcuts={`${index + 1}`}
                        disabled={submitting}
                        onClick={() => submitAnswer(option)}
                      >
                        <kbd>{index + 1}</kbd>
                        <span>{option}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <form className={styles.answerForm} onSubmit={submitForm}>
                    <label htmlFor="learning-answer">你的答案</label>
                    <input
                      ref={inputRef}
                      id="learning-answer"
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      onKeyDown={handleInputKeyDown}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <div className={page.actions}>
                      <Button type="submit" disabled={!answer.trim() || submitting}>
                        提交答案
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() => submitAnswer('', true)}
                        disabled={submitting}
                      >
                        显示答案
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {result && (
              <div
                className={`${styles.feedback} ${result.correct ? styles.correct : styles.incorrect}`}
                aria-live="polite"
              >
                <div className={styles.feedbackTitle}>
                  <Icon icon={result.correct ? 'lucide:check-circle-2' : 'lucide:circle-x'} />
                  <div>
                    <h2>{result.correct ? '回答正确' : '回答不正确'}</h2>
                    <div className={styles.answerComparison}>
                      {!result.correct && (
                        <p>
                          你的答案：<strong>{answer || '已查看答案'}</strong>
                        </p>
                      )}
                      <p>
                        正确答案：<strong>{result.expectedAnswer}</strong>
                      </p>
                    </div>
                  </div>
                </div>
                <p className={styles.explanation}>{result.explanation}</p>
                {result.contentUpdated && (
                  <p className={styles.versionNotice}>
                    本题使用开始学习时的内容版本，结果已保留，但不会改变当前掌握度。
                  </p>
                )}
                {result.reinforcementScheduled && (
                  <p className={styles.reinforcementNotice}>
                    <Icon icon="lucide:rotate-ccw" />
                    这项内容会在本组结束前再练一次。
                  </p>
                )}
                <div className={styles.feedbackMeta}>
                  <span>掌握度 {result.mastery}%</span>
                  <span>{ratingLabels[result.rating]}</span>
                  <span>下次复习：{formatNextReview(result.nextDueAt)}</span>
                </div>
                <div className={page.actions}>
                  <Button onClick={continueLearning} disabled={loadingNext}>
                    {loadingNext ? '正在准备' : result.sessionComplete ? '查看本组结果' : '下一题'}
                    <Icon icon="lucide:arrow-right" />
                  </Button>
                  <Button variant="secondary" onClick={askAi} disabled={aiLoading}>
                    <Icon icon="lucide:sparkles" />
                    {aiLoading ? '正在生成讲解' : '生成讲解'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {aiResponse && (
          <Panel className={styles.aiPanel}>
            <div className={styles.aiContent}>
              <div className={styles.aiTitle}>
                <span className={page.iconChip}>
                  <Icon icon="lucide:sparkles" />
                </span>
                <div>
                  <h2>补充讲解</h2>
                  <p>结合本题内容与当前学习记录</p>
                </div>
              </div>
              <p>{aiResponse.summary}</p>
              <ul>
                {aiResponse.keyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <div className={styles.variant}>
                <strong>变式练习</strong>
                <p>{aiResponse.practice.question}</p>
                <details>
                  <summary>查看答案</summary>
                  <p>{aiResponse.practice.answer}</p>
                </details>
              </div>
            </div>
          </Panel>
        )}

        {error && <p className={page.error}>{error}</p>}
      </div>

      <dialog
        ref={exitDialogRef}
        className={styles.exitDialog}
        aria-labelledby="exit-dialog-title"
        aria-describedby="exit-dialog-description"
        onCancel={(event) => {
          event.preventDefault();
          closeExitDialog();
        }}
      >
        <div className={styles.exitDialogBody}>
          <span className={styles.exitDialogIcon} aria-hidden="true">
            <Icon icon="lucide:pause" />
          </span>
          <div className={styles.exitDialogCopy}>
            <h2 id="exit-dialog-title">退出当前任务？</h2>
            <p id="exit-dialog-description">
              暂存后可从今日学习或学习中心继续。结束后保留已完成记录，未答内容不计入结果。
            </p>
          </div>
          {exitError && (
            <p className={`${page.error} ${styles.exitDialogError}`} role="alert">
              {exitError}
            </p>
          )}
          <div className={styles.exitDialogActions}>
            <Button variant="quiet" onClick={closeExitDialog} disabled={ending}>
              继续学习
            </Button>
            <Button variant="secondary" onClick={pauseSession} disabled={ending}>
              暂存并退出
            </Button>
            <Button variant="danger" onClick={abandonSession} disabled={ending}>
              {ending ? '正在结束' : '结束本组'}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
