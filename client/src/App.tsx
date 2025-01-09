import { useEffect, useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { toolkit } from "./blot/src/drawingToolkit/toolkit.js";
import { createHaxidraw } from "./blot/src/haxidraw/createHaxidraw.js";
import { createWebSerialBuffer } from "./blot/src/haxidraw/createWebSerialBuffer.js";
import "./App.css";

type Polylines = number[][][];

let haxidraw: any = null;

const App = () => {
  // States
  const [polylines, setPolylines] = useState<Polylines | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [countdown, setCountdown] = useState<number | null>(null);

  const webcamRef = useRef<Webcam>(null);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Handle Drawing
  const draw = async (lines: Polylines) => {
    if (!haxidraw) {
      setError("Haxidraw is not connected.");
      return;
    }

    try {
      await haxidraw.servo(1000); // Pen up
      await haxidraw.goTo(0, 0);

      for (const lineGroup of lines) {
        for (let j = 0; j < lineGroup.length; j++) {
          const [x, y] = lineGroup[j];
          await haxidraw.goTo(x, 125 - y);

          if (j === 0) {
            await haxidraw.servo(1700); // Pen down
            await sleep(100);
          }
        }
        await haxidraw.servo(1000); // Pen up
        await sleep(150);
      }
    } catch (err) {
      setError(`Drawing error: ${(err as Error).message}`);
    }
  };

  // Convert SVG to Polylines
  const convertToPolylines = (svgString: string) => {
    try {
      const result = toolkit.svgToPolylines(svgString);
      const resizedPolylines = toolkit.scalePolylinesToDimension(
        JSON.stringify(result),
        100,
        100,
        true
      );
      const parsedPolylines = JSON.parse(resizedPolylines);
      setPolylines(parsedPolylines);
      draw(parsedPolylines);
      setError("");
    } catch (err) {
      setError(`SVG conversion error: ${(err as Error).message}`);
    }
  };

  // Upload to server
  const uploadFrame = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(`http://127.0.0.1:8000/submit-frame`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload image to server.");

      const data = await response.json();
      if (data.svg) {
        const parser = new DOMParser();
        const document = parser.parseFromString(data.svg, "image/svg+xml");
        const svg = document.querySelector("svg");
        if (!svg) throw new Error("Invalid SVG data.");

        const rect = svg.querySelector("rect");
        if (rect) {
          svg.setAttribute("width", rect.getAttribute("width")!);
          svg.setAttribute("height", rect.getAttribute("height")!);
          svg.removeChild(rect);
        }

        const cleanSvgString = new XMLSerializer().serializeToString(svg);
        setSvgContent(cleanSvgString);
        convertToPolylines(cleanSvgString);
      } else {
        throw new Error("SVG generation failed.");
      }
    } catch (err) {
      setError(`Upload error: ${(err as Error).message}`);
    }
  }, []);

    // Handle Compute with Countdown
    const handleCompute = () => {
      setCountdown(5);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            setCountdown(null);
            takeSnapshotAndUpload();
          }
          return prev! - 1;
        });
      }, 1000);
    };
  

  // Take Snapshot and Upload
  const takeSnapshotAndUpload = async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const byteString = atob(imageSrc.split(",")[1]);
        const mimeString = imageSrc.split(",")[0].split(":")[1].split(";")[0];
        const arrayBuffer = Uint8Array.from(byteString, (char) => char.charCodeAt(0));
        const blob = new Blob([arrayBuffer], { type: mimeString });
        const file = new File([blob], "snapshot.png", { type: mimeString });
        await uploadFrame(file);
      }
    }
  };

  // Connect to Haxidraw
  const connect = async () => {
    if (!navigator.serial) {
      alert("Your browser doesn't support the Web Serial API.");
      return;
    }

    try {
      const port = await navigator.serial.requestPort({});
      const comsBuffer = await createWebSerialBuffer(port);
      haxidraw = await createHaxidraw(comsBuffer);
      setConnectionStatus("Connected");
    } catch {
      setError("Failed to connect to Haxidraw.");
    }
  };

  // Disconnect Haxidraw
  const disconnect = async () => {
    if (haxidraw && haxidraw.port) {
      try {
        await haxidraw.port.close();
      } catch (err) {
        console.error("Disconnect error:", err);
      }
    }
    haxidraw = null;
    setConnectionStatus("Disconnected");
  };

  return (
    <div className="container">
    <div className="top-right-toggle">

        <button         className="button warning-button" onClick={connectionStatus === "Connected" ? disconnect : connect}>
          {connectionStatus === "Connected" ? "Disconnect" : "Connect"}
        </button>
    </div>

    <div className="top-left-name">
      <button className="button name-button" onClick={() => alert("Name Button")}>
        Calo and Dominic
      </button>
    </div>

    <div className="innerBox">
      <div className="webcam-container">
        <Webcam
          audio={false}
          height={600}
          width={600}
          ref={webcamRef}
          screenshotFormat="image/png"
        />
        {countdown !== null && (
          <div className="countdown-overlay">
            <h1>{countdown}</h1>
          </div>
        )}
      </div>

      <button className="button compute-button" onClick={handleCompute}>
        Compute
      </button>

      <h1>THE HOMEWORK MACHINE</h1>
    </div>
  </div>
  );
};

export default App;