import re
import unicodedata
from textwrap import TextWrapper
from typing import Dict, List


class MassReplacer:
    def __init__(self, corpus: Dict[str, str]):
        self._escaped_corpus = {re.escape(k): v for k, v in corpus.items()}
        self._pattern = re.compile("|".join(self._escaped_corpus.keys()))

    def replace(self, text: str) -> str:
        return self._pattern.sub(lambda match: self._escaped_corpus[re.escape(match.group(0))], text)


wrapper = TextWrapper()

normalizer = MassReplacer({
    "“": "\"",
    "”": "\"",
    "‘": "\'",
    "’": "\'",
})

placeholder = MassReplacer({
    "Q": "O",
    "X": "O",
    "Z": "O",
    "—": "\u00A0- ",
    "–": "-",
})


def split(text: str, length: int) -> List[str]:
    assert length > 0

    wrapper.width = length

    lines = []

    for paragraph in text.splitlines():
        if not paragraph:
            lines.append("")
            continue

        lines += wrapper.wrap(paragraph)

    return lines


def normalize(text: str) -> str:
    compat = unicodedata.normalize("NFKC", text)

    return normalizer.replace(text)


def placehold(text: str) -> str:
    return placeholder.replace(text)
