import React, { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Sampler.css";

const Sampler: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<any[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<any[]>([]);
  const prompt = "two-twenty carried, for him";
  const [drawing, setDrawing] = useState(false);

  const startDrawing = (x: number, y: number) => {
    setDrawing(true);
    setCurrentStroke([{ x, y, t: Date.now() }]);
  };

  const draw = (x: number, y: number) => {
    if (!drawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    setCurrentStroke((prev) => [...prev, { x, y, t: Date.now() }]);
  };

  const endDrawing = () => {
    setDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes((prev) => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.beginPath();
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx)
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    setStrokes([]);
  };

  const sendDataToServer = async () => {
    const data = {
      username: searchParams.get("username"),
      transcription: prompt,
      strokes,
    };

    setStrokes([]);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/save-handwriting-sample",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }
      alert("Data successfully sent to the server!");
    } catch (error) {
      console.error("Error sending data:", error);
      alert("Failed to send data to the server.");
    }
  };

  const redirectToHomepage = () => {
    navigate(`/?username=${searchParams.get("username")}`);
  };

  return (
    <div className="collector">
      <button id="redirectBtn" onClick={redirectToHomepage}>
        Go to Homepage
      </button>
      <div id="prompt">{prompt}</div>
      <canvas
        id="drawingPad"
        ref={canvasRef}
        width={800}
        height={400}
        onMouseDown={(e) =>
          startDrawing(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
        }
        onMouseMove={(e) => draw(e.nativeEvent.offsetX, e.nativeEvent.offsetY)}
        onMouseUp={endDrawing}
        onMouseOut={endDrawing}
        onTouchStart={(e) => {
          e.preventDefault();
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const touch = e.touches[0];
            startDrawing(touch.clientX - rect.left, touch.clientY - rect.top);
          }
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const touch = e.touches[0];
            draw(touch.clientX - rect.left, touch.clientY - rect.top);
          }
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          endDrawing();
        }}
      ></canvas>
      <div className="buttons">
        <button id="clearBtn" onClick={clearCanvas}>
          Clear/Restart
        </button>
        <button id="sendBtn" onClick={sendDataToServer}>
          Send Data to Server
        </button>
      </div>
    </div>
  );
};

export default Sampler;
