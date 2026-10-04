#!/bin/sh
# =============================================================================
# build_sort.sh —— 第 10 集：C → ELF → 裸镜像
#
# 目标是一颗只认最小 RV64I 的核：-march=rv64i（不带 M / C / Zbb），
# lp64 ABI（long 与指针都是 64 位，正好对上这台机器的双字访存）。
# 产物三个：sort.elf 用来看（反汇编、段表），两个 .bin 用来装进
# cpu.prism 里 run 块的 image 段——芯片源码一行都不改。
# =============================================================================
set -e
cd "$(dirname "$0")"

LLVM=$(brew --prefix llvm)/bin
LLD=$(brew --prefix lld)/bin/ld.lld
[ -x "$LLD" ] || { echo "缺链接器 lld：brew install lld"; exit 1; }

# ① 编译 + 链接：-T 交地址图，-nostdlib 让它谁都别依赖
"$LLVM/clang" --target=riscv64 -march=rv64i -mabi=lp64 \
    -ffreestanding -nostdlib -mno-relax -O1 \
    -T sort.ld sort.c -o sort.elf \
    --ld-path="$LLD"

# ② 拆裸镜像：.text 进 im，.data 进 dm（.bss 不用装——dm 的复位值就是 0）
"$LLVM/llvm-objcopy" -O binary --only-section=.text sort.elf sort_text.bin
"$LLVM/llvm-objcopy" -O binary --only-section=.data sort.elf sort_data.bin

ls -l sort.elf sort_text.bin sort_data.bin
