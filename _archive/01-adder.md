# 第 1 集：从一颗加法器开始

> 目标：20 分钟写出第一个能仿真的 Prism 硬件模块——32 位加法器。
> 读完本文，你对 Prism 的模块、端口、组合逻辑和仿真流程会有一个直观印象。

---

## 1. 为什么从加法器开始？

加法器是硬件界的 "Hello World"。它不依赖复杂协议、没有时序陷阱，却能展示硬件
描述语言最核心的三件事：

1. **模块（module）**：电路的封装单元。
2. **端口（port）**：模块与外界的接口。
3. **组合逻辑**：输入一变，输出立刻跟着变的电路。

Prism 的设计哲学是：算法层只写"做什么"，调度层再补"怎么做"。本文我们先关注
算法层，把心思放在电路上。

---

## 2. 环境准备

Prism 编译器在本仓库 `prism/frontend/prism.py`；`run --cosim` 需要 Icarus Verilog。

```bash
# 安装 iverilog（macOS）
brew install icarus-verilog

# 编译器位置
export PRISM_HOME=/Users/zhuzg/works/soc/prism

# 确认 CLI 可用
python3 $PRISM_HOME/frontend/prism.py --help
```

本集源码在 `prism/docs/blog/examples/adder.prism`。

---

## 3. 32 位加法器

三个 32 位无符号端口——两个输入 `a`、`b`，一个输出 `sum`——和一句组合赋值
`sum = a + b`。这就是一个加法器的全部。

```prism
module adder {
    in  a   : Signal<u32>
    in  b   : Signal<u32>
    out sum : Signal<u32>

    sum = a + b
}

@schedule adder {
    bitwidth  : { data:32 }
    pipeline  : 1 stage
    storage   : none
    interface : a, b, sum = Signal
    reset     : async_low
    clock     : 100 MHz, domain = single
    resource  : none
    latency   : 1 cycle
}

design adder_top {
    dut : adder
}

run adder_check of adder_top {
    stim : {
        a, b = {
                     0,          0,
                     1,          2,
                   100,        200,
            2147483647, 2147483647,  // 2^31-1 + 2^31-1 = 2^32-2
            4294967295,          1,  // 回绕：2^32-1 + 1 → 0
        }
    }
    until : end of stim
    show  : { a, b, sum }
}
```

### 代码解读

**算法层（`module adder`）**

- `module adder { ... }` 定义一个模块，内部声明端口和逻辑。
- `Signal<u32>`：**32 位无符号信号端口**。`u<N>` 是无符号、`i<N>` 是有符号；
  Prism 的 `+` 会按端口位宽自动截断（`u32` 加满 `2^32` 回绕到 0）。
- `sum = a + b`：组合赋值，描述输入到输出的函数关系。Prism 会推导出 `a + b`
  的位宽是 32，赋给 32 位 `sum`——不需要你手写位宽表。

**调度层（`@schedule adder`）**

`@schedule` 补齐 7 项 G1~G7 元数据，告诉编译器"这个模块如何下降到 RTL"：

- `interface : a, b, sum = Signal`——三个端口全部按 `Signal`（裸电平）协议
  对外，无握手。
- `storage : none`——没有寄存器，纯组合逻辑。
- `pipeline : 1 stage` / `latency : 1 cycle`——一拍算完。

**顶层例化（`design adder_top`）**

`design` 用来把模块实例组装成完整电路。本集只有一个模块，`dut : adder` 就够；
后续章节会用它串多模块。

**仿真入口（`run adder_check`）**

- `stim : { a, b = { … } }`：一张激励表。列名 `a, b` 只在列头写一次，每两个值一拍（换行只是排版），共 5 拍。
- `until : end of stim`：跑完这 5 拍就停。
- `show : { a, b, sum }`：观测这三列，逐行打印。

---

## 4. 运行

```bash
cd /Users/zhuzg/works/soc
python3 $PRISM_HOME/frontend/prism.py run \
    prism/docs/blog/examples/adder.prism --cosim
```

真实输出：

```
cycle	a	b	sum
0	0	0	0
1	1	2	3
2	100	200	300
3	2147483647	2147483647	4294967294
4	4294967295	1	0
# stop: end of stim (5 cycles)
[run --cosim] ✅ PASS: adder_check golden == RTL 仿真（5 拍 × 3 列全等；golden stop: end of stim (5 cycles)）
```

表头首列 `cycle` 是隐式拍号，其余三列按 `show` 声明序。对照手算：

| cycle | a          | b          | sum        | 校验 |
|-------|------------|------------|------------|-----|
| 0     | 0          | 0          | 0          | ✓ |
| 1     | 1          | 2          | 3          | ✓ |
| 2     | 100        | 200        | 300        | ✓ |
| 3     | 2³¹-1      | 2³¹-1      | 2³²-2      | 满载不溢出 ✓ |
| 4     | 2³²-1      | 1          | 0          | 无符号回绕 ✓ |

第 4 拍是**满载**——两个 `2^31-1` 相加刚好把 `sum` 打到 `u32` 的最高可用值
（`4294967294 = 2^32 - 2`）；第 5 拍**回绕**——`2^32-1 + 1` 在 32 位无符号下
落回 0。Prism 的加法和 Verilog 语义一样是**位宽截断**，这一点在跨语言对接时
要记住。

### `--cosim` 抓的是什么

如果只跑 `run`（不带 `--cosim`），Prism 会用内置的 Python 参考模型（golden）
出结果，是"编译器自证"。加上 `--cosim`，编译器会把模块下降成 SystemVerilog、
调用 `iverilog` 真跑一遍，把 SV 侧的观测序列和 golden 侧逐拍逐列比对；两边
全等才打 PASS。

这一步同时钉住了两个后端：golden 求值器和 RTL 生成器——回归时任何一个出错，
`--cosim` 都会立刻指出是哪一拍哪一列分歧。

---

## 5. 生成的 RTL 长什么样

`prism.py gen-rtl` 把 `.prism` 下降到可综合的 SystemVerilog：

```bash
python3 $PRISM_HOME/frontend/prism.py gen-rtl \
    prism/docs/blog/examples/adder.prism -o /tmp/adder.sv
```

`/tmp/adder.sv` 里 `adder` 模块本体的核心部分（去掉 clk/rst 与顶层网表包装）：

```systemverilog
module adder_rtl #(parameter int DW = 32)(
  input  logic clk,
  input  logic rst_n,
  input  logic [32-1:0] a,
  input  logic [32-1:0] b,
  output logic [32-1:0] sum
);
  // [P7] 组合输出 / 局部 wire 赋值
  assign sum = (a + b);
endmodule
```

对照 `.prism` 源码：`Signal<u32>` 就是 `logic [31:0]`，`sum = a + b` 就是
一条 `assign`。Prism 帮你把端口位宽、时钟复位分发、顶层网表包装全部生成，
但电路核心和你手写的等价。

---

## 6. 小结

这一集我们：

1. 用 Prism 写了**32 位加法器**：3 个 `u32` 端口，一句 `sum = a + b`。
2. 用 `run` 段声明 5 组激励，覆盖普通值 / 满载 / 回绕三类边界。
3. 用 `--cosim` 把 **golden 参考模型** 与 **iverilog 仿真 SV** 逐拍对撞，
   一次同时验证组合语义实现和 RTL 后端下降。

同时熟悉了 Prism 的完整工具链：

```
.prism 源码
    ↓
@schedule 调度层（补齐位宽、pipeline、storage 等 7 项）
    ↓
python3 prism.py run            → golden 直跑（Python 参考模型）
python3 prism.py run --cosim    → golden vs iverilog RTL 逐拍对撞
python3 prism.py gen-rtl        → 生成 Verilog 供下游综合
```

下一集，我们讲 Prism 的**类型系统**——`u<N>` / `i<N>` / `bool`、位宽推导规则、
以及为什么 1 位有符号 `i1` 只能取 `{-1, 0}`。会用类型系统把这一集的加法器
扩到带符号版本，观察溢出与回绕的语义差。

---

## 练习

1. 把端口从 `Signal<u32>` 换成 `Signal<i32>`，同时把 `stim` 里最后两行的
   `4294967295` 与 `2147483647` 换成同位宽有符号域的值（比如 `-1`、`-2`），
   重跑 `--cosim`：`sum` 列现在按 `i32` 回绕显示。
2. 把 `stim` 表里的 `4294967295` 换成 `5000000000`（超过 `u32` 上限），
   跑一次 `run`——报错会精确指出"向量 4 'a'=5000000000 越界
   （端口位宽 u32，范围 [0,4294967295]）"。
3. 在 `show` 里加一列表达式 `(a + b) as direct`——它是**表达式列**，
   和端口列 `sum` 独立求值；观察两列是否逐拍相等，理解"表达式列"与
   "端口列"在 `--cosim` 里是**同一份 golden**、**两条 RTL 通路**。

---

## 附：本集源码

- `prism/docs/blog/examples/adder.prism`

一条命令复现本集：

```bash
export PRISM_HOME=/Users/zhuzg/works/soc/prism
cd /Users/zhuzg/works/soc
python3 $PRISM_HOME/frontend/prism.py run \
    prism/docs/blog/examples/adder.prism --cosim
```
