# 七日创造

> 一个软件工程师，七天，从"发明一门语言"开始，造出能跑操作系统的 RISC-V 处理器。

《圣经·创世记》里神用七天创造天地万物。这个连载借它的骨架——七日、七层递进——讲另一件小事：**用一门新语言 Prism，从一颗加法器一路造到能启动 OpenSBI**。

作者是一个人，工具是自己造的，编译器随文开源。

---

## 七日导览

| 日 | 《创世记》 | 造什么 | 集 |
|---|---|---|---|
| **一 · 光** | "神说，要有光，就有了光。" | Prism 工具箱：为什么这门语言存在、语法骨架、一颗 CPU 的样例、跑起来看 | Ep 1–4 || **二 · 空气与水** | "诸水之间要有空气，将水分为上下。" | 四颗器官：`pc` 下一步 / `memory` 记忆 / `ALU` 活动 / `decoder` 理解世界；各自能测；然后 `cpu_top` 合体、跑一段冒泡排序 | Ep 5–10 |
| **三 · 旱地与植物** | "天下水要聚集一处，使旱地露出来。" | 原第三日内容已并入第二日；本日待重新规划 | — |
| **四 · 天上光体** | "天上要有光体，可以分昼夜、定节令。" | `Composer` 一次声明五段生成 · 五级流水线 · 冒险与前递 · RV64I | Ep 11–15 |
| **五 · 有生命的活物** | "地要生出活物来，各从其类。" | 会疼（异常）· 会躲（中断 + PMP）· 会做事（真程序 + 独立 ISS 四方对撞） | Ep 16–20 |
| **六 · 照着形象造人** | "使他们管理海里的鱼、空中的鸟。" | SoC：总线 / SRAM / BootROM / PLIC / UART；CPU 第一次"管理"外部世界 | Ep 21–24 |
| **七 · 安息** | "神造物的工已经完毕，就在第七日歇了他一切的工。" | OpenSBI 起来；作者退场，机器自转 | Ep 25 |

**学习曲线**：语言 → 分层 → 单周期 RV64I → 流水线 RV64I → 完整特权处理器 → 最小 SoC → 跑起 OpenSBI。

**一次给光，七日造物。** 第一日之后不再讲语法——每一日只回答一个问题：**下一步该造什么**。

---

## 为什么要有这门语言

硬件开发有两条**割裂的路**：

- **RTL**（Verilog / SystemVerilog / VHDL）：周期精确、可综合、可流片；但算法与微架构缠在一起，验证成本高。
- **SystemC / TLM**：事务级、快数个数量级，适合架构探索与作为黄金参考；但**不可综合**，与最终 RTL 的一致性全靠人工维护。

两条路描述**同一个硬件**、要各写一遍——**行为等价性无保证**。HLS 只补了"算法 → RTL"这一半，输入还得是可综合子集，产不出用于架构探索的 TLM 快模型。

Prism 的答案：**一份源码，同时下降为 RTL + TLM + 独立 Python golden**，三方 cosim 闭环逐拍对撞。名字（棱镜）就是这张图——一束算法折射出两道光谱，第三个棱面独立验收。

---

## 依赖

- **Prism 编译器**：`pip install prism-hdl`，装好后全局命令 `prism` 即可使用。
- **仿真依赖**（`cosim` 对撞要 iverilog；`--sim systemc` 还要 SystemC 与 C++ 编译器）：装完编译器跑 `prism deps --install`，按操作系统把缺的补齐（C++ 编译器只提示、需自装）。`prism deps` 单跑则出一份自检报告。
- **Python 3**（编译器运行环境）。

一条命令复现某一集：

```bash
prism run  examples/adder.prism --debug              # ① golden 直跑
prism cosim examples/adder.prism --run adder_check   # ② SV 真仿真逐拍对撞
```

---

## 目录

```
seven-days/
├── README.md              ← 你正在读
├── outline.md             ← 主 outline · 25 集 · 创世记版
├── outline-nvwa.md        ← 番外 · 25 集 · 女娲七日造人版（仅供对照，不发布）
├── episodes/              ← 每一集的正文（HTML）
│   ├── index.html         ← 落地页（七日导览 + 快速上手）
│   ├── outline.html       ← 25 集大纲（网页版）
│   ├── day1/              ← 光 · 4 集
│   └── day2/              ← 空气与水 · 6 集
├── examples/              ← 每一集引用的 Prism 源码（可独立跑）
└── _archive/              ← 重构前的旧草稿，仅供对照
```

---

## 状态

连载写作中。当前进度：

- **主大纲** 已定稿（`outline.md`，创世记版 · 25 集）
- **番外** 保留（`outline-nvwa.md`，女娲版 · 25 集）——不发布，仅供写作时借"引绳于泥中，举以为人"给 `Composer` 那一集做点睛
- **第一日 · 光 四集写完**：`episodes/day1/` 下 `01-why-prism` / `02-layered` / `03-cpu-top` / `04-let-there-be-light`，配套样例在 `examples/`（`adder` / `proc_switch` / `mini_cpu` / `box`）
- **第二日 · 空气与水 六集写完**（最小 RV64I）：`episodes/day2/` 下 `05-pc` / `06-memory` / `07-alu` / `08-decoder` / `09-cpu-top` / `10-bubble-sort`，配套样例都在 `examples/day2/`（`pc` / `memory` / `alu` / `decoder` 各自能跑能撞，`cpu.prism` 把四颗 import 进一份 design，27 拍跑出 `x1 = 15`，golden / RTL / SystemC 三条腿逐拍全等；`bubble_sort` run 换一份镜像（32 条指令 + 六个数的数组），417 拍把 `9 7 5 3 2 1` 排成 `1 2 3 5 7 9`，停机判据是程序自己写的完工位）
- **第三日待重新规划，第四日起** 未动笔

---

## 联系

作者：<https://github.com/ifnfn> · 组织：<https://github.com/prism-hdl>
