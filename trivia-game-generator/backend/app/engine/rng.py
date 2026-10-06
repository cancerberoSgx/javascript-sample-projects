"""Seedable PRNG (mulberry32), bit-for-bit the same as rng.ts. The state is a signed 32-bit int."""

_M = 0xFFFFFFFF


def _i32(x: int) -> int:
    x &= _M
    return x - 0x1_0000_0000 if x & 0x8000_0000 else x


def next_random(state: int) -> tuple[float, int]:
    nxt = _i32(state + 0x6D2B79F5)
    t = nxt & _M
    t = ((t ^ (t >> 15)) * (t | 1)) & _M
    t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & _M)) & _M
    return ((t ^ (t >> 14)) & _M) / 4294967296, nxt


def random_int(state: int, lo: int, hi: int) -> tuple[int, int]:
    r, nxt = next_random(state)
    return lo + int(r * (hi - lo + 1)), nxt


def shuffle[T](items: list[T], state: int) -> tuple[list[T], int]:
    out = list(items)
    s = state
    for i in range(len(out) - 1, 0, -1):
        j, s = random_int(s, 0, i)
        out[i], out[j] = out[j], out[i]
    return out, s
