"""エントリーポイント。`multi-ai` コマンド、または `python -m multi_ai_workbench.main`。"""

from __future__ import annotations

import sys
from collections.abc import Sequence


def main(argv: Sequence[str] | None = None) -> int:
    # Windows のコンソールやパイプで表示できない文字があっても落ちないようにする
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(errors="replace")

    from multi_ai_workbench.cli.commands import run

    return run(argv)


if __name__ == "__main__":
    sys.exit(main())
