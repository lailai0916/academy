import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, IconButton, Panel, Progress } from '@lailai0916/ui';
import type {
  CourseAnswerResult,
  CourseAssistanceKind,
  CourseAssistanceResponse,
  CourseQuestionBranch,
  CourseRunView,
} from '@lailai/academy-shared';
import { useNavigate, useParams } from 'react-router';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './CoursePlayerPage.module.css';

const assistanceLabels: Record<CourseAnswerResult['assistanceLevel'], string> = {
  independent: '独立完成',
  hint: '使用提示后完成',
  solution: '查看解法后完成',
};

export function CoursePlayerPage() {
  const navigate = useNavigate();
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<CourseRunView | null>(null);
  const [answer, setAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState('');
  const [result, setResult] = useState<CourseAnswerResult | null>(null);
  const [assistance, setAssistance] = useState<CourseAssistanceResponse | null>(null);
  const [question, setQuestion] = useState('');
  const [branches, setBranches] = useState<CourseQuestionBranch[]>([]);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!runId) return;
    setError('');
    try {
      const response = await api<{ run: CourseRunView }>('/course-runs/' + runId);
      setRun(response.run);
      setBranches(response.run.branches);
      setAnswer('');
      setSubmittedAnswer('');
      setResult(null);
      setAssistance(null);
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!run) return;
    window.scrollTo({ top: 0, left: 0 });
  }, [run?.status, run?.step?.id]);

  const currentBranches = useMemo(
    () => branches.filter((branch) => branch.stepId === run?.step?.id),
    [branches, run?.step?.id]
  );

  const completeReading = async () => {
    if (!runId || !run?.step || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/course-runs/' + runId + '/complete', {
        method: 'POST',
        body: JSON.stringify({ stepId: run.step.id }),
      });
      await load();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async (nextAnswer: string) => {
    if (!runId || !run?.step || busy || !nextAnswer.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await api<{ result: CourseAnswerResult }>(
        '/course-runs/' + runId + '/answer',
        {
          method: 'POST',
          body: JSON.stringify({ stepId: run.step.id, answer: nextAnswer }),
        }
      );
      setSubmittedAnswer(nextAnswer);
      setResult(response.result);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    void submitAnswer(answer);
  };

  const requestAssistance = async (kind: CourseAssistanceKind) => {
    if (!runId || !run?.step || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await api<{ assistance: CourseAssistanceResponse }>(
        '/course-runs/' + runId + '/assistance',
        {
          method: 'POST',
          body: JSON.stringify({ stepId: run.step.id, kind }),
        }
      );
      setAssistance(response.assistance);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  const askQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (!runId || !run?.step || asking || question.trim().length < 2) return;
    setAsking(true);
    setError('');
    try {
      const response = await api<{ branch: CourseQuestionBranch }>(
        '/course-runs/' + runId + '/questions',
        {
          method: 'POST',
          body: JSON.stringify({ stepId: run.step.id, question }),
        }
      );
      setBranches((current) => [...current, response.branch]);
      setQuestion('');
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setAsking(false);
    }
  };

  if (error && !run) {
    return (
      <div className={styles.centerState}>
        <p className={page.error}>{error}</p>
        <Button variant="secondary" onClick={() => navigate('/courses')}>
          返回课程
        </Button>
      </div>
    );
  }

  if (!run) return <div className={styles.centerState}>正在恢复课程进度……</div>;

  if (run.status === 'completed' && run.summary) {
    const isRetest = run.summary.mode === 'retest';
    return (
      <div className={styles.player}>
        <header className={styles.topbar}>
          <IconButton label="返回课程" onClick={() => navigate('/courses')}>
            <Icon icon="lucide:x" />
          </IconButton>
          <Progress label="课程进度" value={100} showValue={false} />
          <span>已完成</span>
        </header>
        <main className={styles.summaryStage}>
          <Panel feature className={styles.summary}>
            <span className={styles.summaryIcon}>
              <Icon icon="lucide:check-circle-2" />
            </span>
            <p>{isRetest ? '延迟复测' : run.course.grade + ' · 物理'}</p>
            <h1>{isRetest ? '本轮复测完成' : '课程学习完成'}</h1>
            <p className={styles.summaryLead}>
              {isRetest
                ? '结果已写入长期掌握记录，可以回到课程页查看当前状态。'
                : '独立测评已经记录。系统会在七天后开放延迟复测，检验是否真正保留。'}
            </p>
            <div className={styles.summaryMetrics}>
              <article>
                <span>{isRetest ? '复测正确' : '独立测评'}</span>
                <strong>
                  {run.summary.assessmentCorrect} / {run.summary.assessmentTotal}
                </strong>
              </article>
              <article>
                <span>完成时间</span>
                <strong>{new Date(run.summary.completedAt).toLocaleDateString('zh-CN')}</strong>
              </article>
            </div>
            {!isRetest && run.summary.retestDueAt && (
              <p className={styles.summaryNotice}>
                <Icon icon="lucide:calendar-clock" />
                延迟复测将在
                {new Date(run.summary.retestDueAt).toLocaleDateString('zh-CN')}开放。
              </p>
            )}
            <div className={page.actions}>
              <Button variant="primary" onClick={() => navigate('/courses')}>
                返回课程总览
              </Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                回到今日学习
              </Button>
            </div>
          </Panel>
        </main>
      </div>
    );
  }

  if (!run.step) return <div className={styles.centerState}>课程步骤暂时不可用。</div>;

  const step = run.step;
  const progress = Math.round((step.progress.completed / step.progress.total) * 100);
  const isMeasured = step.phase === 'assessment' || step.phase === 'retest';

  return (
    <div className={styles.player}>
      <header className={styles.topbar}>
        <IconButton label="退出课程" onClick={() => navigate('/courses')}>
          <Icon icon="lucide:x" />
        </IconButton>
        <Progress label="课程进度" value={progress} showValue={false} />
        <span>
          {step.progress.completed + 1} / {step.progress.total}
        </span>
      </header>

      <div className={styles.workspace}>
        <Panel feature className={styles.lessonPanel}>
          <article className={styles.lesson}>
            <header className={styles.lessonHeader}>
              <div>
                <span>{step.phaseLabel}</span>
                <small>{run.mode === 'retest' ? '延迟复测' : run.course.title}</small>
              </div>
              <h1>{step.title}</h1>
              <p>{step.instruction}</p>
            </header>

            <div className={styles.content}>
              {step.content.map((block, index) => {
                if (block.kind === 'formula') {
                  return (
                    <div className={styles.formula} key={index}>
                      {block.expression}
                    </div>
                  );
                }
                if (block.kind === 'bullets') {
                  return (
                    <ul key={index}>
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  );
                }
                if (block.kind === 'callout') {
                  return (
                    <aside className={styles.callout} key={index}>
                      <strong>{block.title}</strong>
                      <p>{block.text}</p>
                    </aside>
                  );
                }
                return <p key={index}>{block.text}</p>;
              })}
            </div>

            {step.kind === 'reading' ? (
              <div className={styles.continue}>
                <Button variant="primary" size="lg" disabled={busy} onClick={completeReading}>
                  {busy ? '正在保存' : '理解了，继续'}
                  <Icon icon="lucide:arrow-right" />
                </Button>
              </div>
            ) : (
              <section className={styles.questionArea}>
                <div className={styles.questionPrompt}>
                  <span>{isMeasured ? '请独立作答' : '现在试一试'}</span>
                  <h2>{step.question}</h2>
                </div>

                {!result &&
                  (step.responseKind === 'choice' && step.options ? (
                    <div className={styles.options}>
                      {step.options.map((option, index) => (
                        <button
                          key={option}
                          type="button"
                          disabled={busy}
                          onClick={() => void submitAnswer(option)}
                        >
                          <kbd>{index + 1}</kbd>
                          <span>{option}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <form className={styles.answerForm} onSubmit={submitForm}>
                      <label htmlFor="course-answer">{step.inputLabel ?? '你的答案'}</label>
                      <div>
                        <input
                          id="course-answer"
                          inputMode={step.responseKind === 'number' ? 'decimal' : 'text'}
                          value={answer}
                          onChange={(event) => setAnswer(event.target.value)}
                          autoComplete="off"
                        />
                        <Button variant="primary" type="submit" disabled={busy || !answer.trim()}>
                          {busy ? '正在判断' : '提交答案'}
                        </Button>
                      </div>
                    </form>
                  ))}

                {!result && step.assistanceAvailable && (
                  <div className={styles.assistanceActions}>
                    <span>遇到困难时再使用：</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void requestAssistance('hint')}
                    >
                      给我一个提示
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void requestAssistance('solution')}
                    >
                      查看完整解法
                    </Button>
                  </div>
                )}

                {assistance && !result && (
                  <aside className={styles.assistance}>
                    <strong>{assistance.kind === 'hint' ? '提示' : '完整解法'}</strong>
                    <p>{assistance.content}</p>
                  </aside>
                )}

                {result && (
                  <div
                    className={[styles.feedback, result.correct ? styles.correct : styles.incorrect]
                      .filter(Boolean)
                      .join(' ')}
                    aria-live="polite"
                  >
                    <div className={styles.feedbackHeading}>
                      <Icon icon={result.correct ? 'lucide:check-circle-2' : 'lucide:circle-x'} />
                      <div>
                        <h2>{result.correct ? '回答正确' : '回答不正确'}</h2>
                        <span>{assistanceLabels[result.assistanceLevel]}</span>
                      </div>
                    </div>
                    <p>{result.feedback}</p>
                    {!result.correct && (
                      <div className={styles.answerComparison}>
                        <span>你的答案：{submittedAnswer}</span>
                        {result.advanced && <span>参考答案：{result.expectedAnswer}</span>}
                      </div>
                    )}
                    {result.advanced ? (
                      <Button variant="primary" onClick={() => void load()}>
                        {result.runComplete ? '查看学习结果' : '进入下一步'}
                        <Icon icon="lucide:arrow-right" />
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setResult(null);
                          setAnswer('');
                        }}
                      >
                        根据反馈再试一次
                      </Button>
                    )}
                  </div>
                )}
              </section>
            )}

            {error && <p className={page.error}>{error}</p>}
          </article>
        </Panel>

        {step.questionsAvailable && (
          <aside className={styles.questionBranch}>
            <div className={styles.branchHeading}>
              <span>
                <Icon icon="lucide:messages-square" />
              </span>
              <div>
                <h2>随时追问</h2>
                <p>AI 只根据当前课程材料回答，追问会随课程记录保留。</p>
              </div>
            </div>
            <div className={styles.branches}>
              {currentBranches.map((branch) => (
                <article key={branch.id}>
                  <strong>你问：{branch.question}</strong>
                  <p>{branch.answer}</p>
                  {branch.keyPoints.length > 0 && (
                    <ul>
                      {branch.keyPoints.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
            <form onSubmit={askQuestion}>
              <label htmlFor="course-question">哪里没想通？</label>
              <textarea
                id="course-question"
                rows={4}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="例如：为什么选定系统后，内力不计入合外力冲量？"
              />
              <Button
                variant="secondary"
                type="submit"
                disabled={asking || question.trim().length < 2}
              >
                {asking ? '正在思考' : '向 AI 追问'}
              </Button>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}
