# lailai's Academy — 品牌与界面规范

## 方向

Academy 是安静、可信且专业的高中自学空间。视觉语言与 lailai's Tools 共用
`@lailai/ui` 的基础组件和语义 token，但信息架构针对连续学习任务，而不是工具目录。

- 使用 Apple 风格的清晰层级、系统字体、实体表面和克制动效；
- 不使用装饰性渐变、玻璃拟态或整卡上浮；
- 蓝色只承担操作、选择和进度反馈；
- 学习数据优先于装饰图表，文案不制造时长焦虑；
- 桌面使用固定侧栏，移动端使用顶部品牌栏和四项底部导航；
- 交互目标至少 44 × 44 px，完整支持键盘、输入法合成和减少动态效果。

## 资源

- Logo：`apps/web/public/brand/logo.svg`
- Favicon：`apps/web/public/brand/favicon.ico`
- 共享 UI：[`@lailai/ui`](https://github.com/lailai0916/ui)

## 核心 token

- 强调色：`#0071e3`
- 浅色画布：`#f5f5f7`
- 深色画布：`#1c1c1e`
- 浅色表面：`#ffffff`
- 深色表面：`#2c2c2e`
- 面板圆角：16 px
- 控件圆角：10–12 px
- 基础间距：4 px，组合为 8 px 节奏
- 控件反馈：160 ms；表面与页面反馈：220 ms

实际实现以 `@lailai/ui` 的语义变量为单一真源，不在应用页面复制另一套 token。
