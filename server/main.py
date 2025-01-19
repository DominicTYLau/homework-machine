import os
import shutil
from typing import Dict, List, Optional

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from pydantic import BaseModel
from snowflake import SnowflakeGenerator

import chatgpt
from handsynth.demo import Hand
import preprocessing
from scanner.scan import DocScanner

OUTPUT_DIR = "handsynth_output"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost"],  # Frontend URLs here
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

hand = Hand(max_line_length=100)

handsynth_id_gen = SnowflakeGenerator(0)
user_id_gen = SnowflakeGenerator(1)

user_db: Dict[str, int] = {}


class SynthesisInput(BaseModel):
    username: Optional[str] = None
    text: str
    # Below parameters are for testing only
    bias: float = 1
    style: int = 0
    line_width: int = 70


class StrokePoint(BaseModel):
    x: int
    y: int
    t: Optional[int] = None


class HandwritingSample(BaseModel):
    username: str
    transcription: str
    strokes: List[List[StrokePoint]]


def gen_svg_image(
    lines: List[str],
    *,
    bias: float,
    style: int,
    stroke_color: str = "black",
    stroke_width: float = 1,
):
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"Created ${OUTPUT_DIR} directory.")

    lines_n = len(lines)
    output_file_path = os.path.join(OUTPUT_DIR, f"output_{next(handsynth_id_gen)}.svg")

    print("Synthesizing with style", style)
    print(lines_n, " lines received:\n\n", "\n".join(lines), sep="", end="\n\n")

    hand.write(
        filename=output_file_path,
        lines=lines,
        biases=[bias for _ in range(lines_n)],
        styles=[style for _ in range(lines_n)],
        stroke_colors=[stroke_color for _ in range(lines_n)],
        stroke_widths=[stroke_width for _ in range(lines_n)],
    )

    print("Generated SVG image of handwriting in", output_file_path)

    return output_file_path


def _synthesize(username: str, text: str, bias: float, style: int, line_width: int):
    new_style = style

    if username is not None and username in user_db:
        new_style = user_db[username]

    normalized = preprocessing.normalize(text)
    placeholded = preprocessing.placehold(normalized)
    lines = preprocessing.split(placeholded, line_width)

    with open(
        gen_svg_image(lines, bias=bias, style=new_style), "r", encoding="utf-8"
    ) as f:
        svg_content = f.read()

    return {"svg": svg_content}


@app.get("/")
def index():
    return {"yay": "Things are looking up!"}


@app.post("/synthesize")
def synthesize(inp: SynthesisInput):
    return _synthesize(**dict(inp))


@app.post("/one-and-done")
async def one_and_done(
    image: UploadFile = File(...),
    username: Optional[str] = Form(None),
    bias: float = Form(1),
    style: int = Form(0),
    line_width: int = Form(70),
):
    # Save image to scanner_output
    with open("scanner_output/paper_image.jpg", "wb") as file:
        shutil.copyfileobj(image.file, file)

    # Grayscale and make the image look better using scanner import
    DocScanner(output_dir="scanner_output").scan(
        "scanner_output/paper_image.jpg", output_basename="processed_image.jpg"
    )

    # Call ChatGPT to get the answers
    answers = chatgpt.query_gpt()

    # Synthesize and return handwriting
    return _synthesize(username, answers, bias, style, line_width)


@app.post("/solve")
async def solve(image: UploadFile = File(...)):
    # Save image to scanner_output
    with open("scanner_output/paper_image.jpg", "wb") as file:
        shutil.copyfileobj(image.file, file)

    # Grayscale and make the image look better using scanner import
    DocScanner(output_dir="scanner_output").scan(
        "scanner_output/paper_image.jpg", output_basename="processed_image.jpg"
    )

    # Call ChatGPT to get the answers
    answers = chatgpt.query_gpt()

    return {"result": answers}


@app.post("/save-handwriting-sample")
async def save_handwriting_sample(inp: HandwritingSample):
    if inp.username in user_db:
        user_id = user_db[inp.username]
    else:
        user_id = next(user_id_gen)
        user_db[inp.username] = user_id

    char_path = os.path.join("styles", f"style-{user_id}-chars.npy")
    strokes_path = os.path.join("styles", f"style-{user_id}-strokes.npy")

    chars_dtype = f"|S{len(inp.transcription)}"
    np_chars = np.array(inp.transcription.encode(), dtype=chars_dtype)

    processed = []

    for stroke in inp.strokes:
        last_index = len(stroke) - 1

        for i, point in enumerate(stroke):
            processed.append([point.x, point.y, 1.0 if i == last_index else 0.0])

    np_processed: np.ndarray = np.array(processed)
    np_processed -= [*np_processed[0, 0:2], 0]
    np_processed *= 200 / np_processed.max()

    offsets: np.ndarray = np.diff(np_processed, axis=0, prepend=[[0, 0, 0]])

    np.save(char_path, np_chars)
    np.save(strokes_path, offsets)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
