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
import { api, ApiRequestError, errorMessage } from '../lib/api';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const startedAt = useRef(Date.now());
  const [prompt, setPrompt] = useState<LearningPrompt | null>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<LearningAnswerResult | null>(null);
  const [summary, setSummary] = useState<LearningSessionSummary | null>(null);
  const [aiResponse, setAiResponse] = useState<AiResponse | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const loadNext = useCallback(async () => {
    setError('');
    setAnswer('');
    setResult(null);
    setAiResponse(null);
    const response = await api<{ prompt: LearningPrompt }>(`/learn/sessions/${sessionId}/next`);
    setPrompt(response.prompt);
    startedAt.current = Date.now();
    window.setTimeout(() => inputRef.current?.focus(), 0);
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
    loadNext().catch((nextError) => {
      if (nextError instanceof ApiRequestError && nextError.status === 404) {
        loadSummary().catch((summaryError) => setError(errorMessage(summaryError)));
        return;
      }
      setError(errorMessage(nextError));
    });
  }, [loadNext, loadSummary]);

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

  if (summary) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <IconButton label="返回学习中心" onClick={() => navigate('/learn')}>
            <Icon icon="lucide:x" />
          </IconButton>
          <Progress label="本组已完成" value={100} showValue={false} />
          <span>
            {summary.completedCount} / {summary.plannedCount}
          </span>
        </header>
        <div className={styles.stage}>
          <Panel feature>
            <div className={styles.summary}>
              <span className={styles.summaryIcon}>
                <Icon icon="lucide:check-circle-2" />
              </span>
              <div className={styles.summaryTitle}>
                <p>
                  {summary.mode === 'diagnostic'
                    ? '水平诊断'
                    : summary.mode === 'review'
                      ? '复习巩固'
                      : '计划学习'}
                </p>
                <h1>本组学习结果</h1>
                <span>{new Date(summary.startedAt).toLocaleString('zh-CN')}</span>
              </div>
              <div className={styles.summaryMetrics}>
                <article>
                  <span>正确率</span>
                  <strong>{summary.accuracy}%</strong>
                </article>
                <article>
                  <span>当前掌握度</span>
                  <strong>{summary.averageMastery}%</strong>
                </article>
                <article>
                  <span>平均反应</span>
                  <strong>{Math.round(summary.averageResponseMs / 100) / 10}s</strong>
                </article>
              </div>
              {summary.delayedAccuracy !== null && (
                <p className={styles.delayedResult}>
                  本组延迟测试正确率为 {summary.delayedAccuracy}%。
                </p>
              )}
              <div className={page.actions}>
                <Button onClick={() => navigate('/learn')}>返回学习中心</Button>
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

  const progress = Math.round((prompt.progress.completed / prompt.progress.total) * 100);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <IconButton label="结束本次学习" onClick={() => navigate('/learn')}>
          <Icon icon="lucide:x" />
        </IconButton>
        <Progress label="本组进度" value={progress} showValue={false} />
        <span>
          {prompt.progress.completed + (result ? 1 : 0)} / {prompt.progress.total}
        </span>
      </header>

      <div className={styles.stage}>
        <Panel feature className={styles.questionPanel}>
          <div className={styles.question}>
            <div className={styles.questionMeta}>
              <span>{prompt.kind === 'word' ? '英语单词' : '古诗词'}</span>
              <span>{prompt.promptType.replace('_', ' ')}</span>
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
                    {prompt.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={submitting}
                        onClick={() => submitAnswer(option)}
                      >
                        {option}
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
                    <h2>{result.correct ? '回答正确' : '这次还没有回忆准确'}</h2>
                    <p>
                      正确答案：<strong>{result.expectedAnswer}</strong>
                    </p>
                  </div>
                </div>
                <p className={styles.explanation}>{result.explanation}</p>
                <div className={styles.feedbackMeta}>
                  <span>掌握度 {result.mastery}%</span>
                  <span>评价 {result.rating}</span>
                  <span>下次复习 {new Date(result.nextDueAt).toLocaleString('zh-CN')}</span>
                </div>
                <div className={page.actions}>
                  <Button onClick={() => (result.sessionComplete ? loadSummary() : loadNext())}>
                    {result.sessionComplete ? '查看本组结果' : '下一题'}
                    <Icon icon="lucide:arrow-right" />
                  </Button>
                  <Button variant="secondary" onClick={askAi} disabled={aiLoading}>
                    <Icon icon="lucide:sparkles" />
                    {aiLoading ? 'AI 正在分析' : 'AI 深入讲解'}
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
                  <h2>AI 讲解</h2>
                  <p>基于本题内容与当前掌握度生成</p>
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
    </div>
  );
}
