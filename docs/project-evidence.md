# Academy 资料来源

核对日期：2026 年 9 月 18 日。

本页保留经历、成果与功能状态的出处，供材料更新时核对。

## 经历与成果

| 内容                          | 来源                                                                                                                       |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| 学校、竞赛成绩与校内荣誉      | [个人简历](https://resume.lailai.one/zh/)                                                                                  |
| 初三返校补学                  | [中考回忆录](https://lailai.one/blog/record/zhongkao)                                                                      |
| NOIP 后退役、GFSSM 分工与成绩 | [资格轮](https://lailai.one/blog/record/gfssm-2026-qualification)、[决赛](https://lailai.one/blog/record/gfssm-2026-final) |
| Sperner 研究与形式化材料      | [研究仓库](https://github.com/lailai0916/saturated-sperner-6-7)、[Zenodo](https://doi.org/10.5281/zenodo.21770438)         |
| iClock 与 Desmos 入选记录     | [作品与证书](https://lailai.one/docs/project/desmos/iclock)                                                                |
| 软件项目                      | [Hydrocarbon Namer](https://github.com/lailai0916/hydrocarbon-namer)、[PeerCoach](https://github.com/lailai0916/peercoach) |

当前高二、物化技选科、学习需求和价格目标来自本人在项目讨论中的说明。成绩按公开简历整理，尚未逐项核对赛事名单与证书；本轮未重跑研究证明。

简历仓库为私有，外部阅读使用[公开网页](https://resume.lailai.one/zh/)或[PDF](https://resume.lailai.one/resume.zh-Hans.pdf)。

## 课程资料

动量课程取自[《功、能量与动量》](https://lailai.one/docs/note/physics/energy-momentum)。原文修订、例题条件与答案统一记在[课程样例](learning-pilot.md)，正式导入前对照教材审核。

## 当前实现

| 代码或文档                                                                          | 核对内容                         |
| :---------------------------------------------------------------------------------- | :------------------------------- |
| [数据表](../apps/api/src/db/schema.ts)、[共享模型](../packages/shared/src/index.ts) | 内容类型为 `word`、`poem`        |
| [AI 服务](../apps/api/src/services/ai.ts)                                           | 记忆题讲解与课程位置相关的追问   |
| [学习会话](../apps/api/src/services/study-sessions.ts)                              | 会话恢复、练习与事件             |
| [记忆模型](../apps/api/src/services/memory-model.ts)                                | FSRS 调度                        |
| [六科目录](../packages/shared/src/curriculum.ts)                                    | 六科范围、课程状态与任务类型     |
| [课程服务](../apps/api/src/services/courses.ts)                                     | 续课、作答、帮助、测评与延迟复测 |
| [课程课堂](../apps/web/src/pages/CoursePlayerPage.tsx)                              | 分步课件、作答、提示、追问和结果 |
| [课程入口](../apps/web/src/pages/CoursesPage.tsx)                                   | 课程真实进度与六科建设状态       |
| [架构说明](architecture.md)                                                         | 模块边界与数据流                 |

个人网站的 Academy 页面可能仍描述早期版本，当前能力以仓库为准。六科目录和课程入口已经建立；动量课程已有连续课堂、教学分支、独立测评和延迟复测，跨科计划尚未实现。
