import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Webcam from "react-webcam";
import Switch from "react-switch";
import { toolkit } from "./blot/src/drawingToolkit/toolkit.js";
import { createHaxidraw } from "./blot/src/haxidraw/createHaxidraw.js";
import { createWebSerialBuffer } from "./blot/src/haxidraw/createWebSerialBuffer.js";
import "./Home.css";

let haxidraw: any = null;

const Home = () => {
  // URL manipulators
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // States
  const [polylines, setPolylines] = useState<Polylines | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Disconnected");
  const [countdown, setCountdown] = useState<number>(0);
  const [hasResult, setHasResult] = useState<boolean>(false);
  const [resultData, setResultData] = useState<string>("");
  const [twoStep, setTwoStep] = useState<boolean>(false);
  const [blotReady, setBlotReady] = useState<boolean>(true);
  const [username, setUsername] = useState<string>(
    searchParams.get("username") ?? "",
  );

  const webcamRef = useRef<Webcam>(null);

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  /* --------------------------------Blot Code-------------------------------------------------*/

  // Handle Drawing
  const draw = async (lines: Polylines) => {
    if (!haxidraw) {
      setError("Haxidraw is not connected.");
      return;
    }

    try {
      setBlotReady(false);

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

    setBlotReady(true);
  };

  // Convert SVG to Polylines
  const convertToPolylines = (svgString: string) => {
    try {
      const result = toolkit.svgToPolylines(svgString);

      const resizedPolylines = toolkit.scalePolylinesToDimension(
        JSON.stringify(result),
        125,
        125,
        true,
      );
      console.log(`const polylines = ${resizedPolylines};`);

      const parsedPolylines = JSON.parse(resizedPolylines);

      setPolylines(parsedPolylines);
      draw(parsedPolylines);

      setError("");
    } catch (err) {
      setError(`SVG conversion error: ${(err as Error).message}`);
    }
  };

  // Connect to Haxidraw
  const connect = async () => {
    if (!navigator.serial) {
      alert("Your browser doesn't support the Web Serial API.");
      return;
    }

    try {
      const port = await navigator.serial.requestPort(
        {} as SerialPortRequestOptions,
      );
      const comsBuffer = await createWebSerialBuffer(port);
      haxidraw = await createHaxidraw(comsBuffer);
      setConnectionStatus("Connected");
      setBlotReady(true);
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

  // Disconnect on component mount
  useEffect(() => {
    disconnect();
  }, []);

  /* --------------------------------Front and Back Code-------------------------------------------------*/

  // Countdown and take picture
  const capture = () => {
    setCountdown(5);

    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    setTimeout(() => {
      clearInterval(interval);
      upload();
    }, 5000);
  };

  // Upload to backend
  const upload = async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const byteString = atob(imageSrc.split(",")[1]);
        const mimeString = imageSrc.split(",")[0].split(":")[1].split(";")[0];
        const arrayBuffer = Uint8Array.from(byteString, (char) =>
          char.charCodeAt(0),
        );
        const blob = new Blob([arrayBuffer], { type: mimeString });
        const file = new File([blob], "snapshot.png", { type: mimeString });

        if (twoStep) {
          await runTwoStep(file);
        } else {
          await oneStep(file);
        }
      }
    }
  };

  // One Step
  const oneStep = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("username", username);
    formData.append("line_width", "52");

    try {
      const response = await fetch(`http://127.0.0.1:8000/one-and-done`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload image to server.");

      const data = await response.json();

      if (data.svg) {
        const parser = new DOMParser();
        const document = parser.parseFromString(data.svg, "image/svg+xml");

        const svg = document.querySelector("svg")!;
        const rect = svg.querySelector("rect")!;

        // fix sizing and remove background rect
        svg.setAttribute("width", rect.getAttribute("width")!);
        svg.setAttribute("height", rect.getAttribute("height")!);
        svg.removeChild(rect);

        // convert SVG back to a string
        const cleanSvgString = new XMLSerializer().serializeToString(svg);

        setSvgContent(cleanSvgString);
        convertToPolylines(cleanSvgString);
      } else {
        throw new Error("SVG generation failed.");
      }
    } catch (err) {
      setError(`Upload error: ${(err as Error).message}`);
    }
  };

  // Part of Two Step
  const runTwoStep = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("line_width", "52");

    try {
      const response = await fetch(`http://127.0.0.1:8000/solve`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload image to server.");

      const data = await response.json();

      if (data.result) {
        setResultData(data.result); // Save result to state
        setHasResult(true); // Hide the webcam and show the result
      } else {
        throw new Error("Result data is missing.");
      }
    } catch (err) {
      setError(`Upload error: ${(err as Error).message}`);
    }
  };

  // Part Two Step to Synthesize and print on blot
  const synthesizeAndPrint = async () => {
    const textarea = document.querySelector(
      ".resultTextarea",
    ) as HTMLTextAreaElement;

    if (!textarea) {
      console.error("Textarea with class 'resultTextarea' not found.");
      return;
    }

    // Extract the value from the textarea and create the payload
    const payload = {
      username,
      text: textarea.value,
      bias: 1, // You can adjust these values
      style: 0, // according to your requirements
      line_width: 70,
    };

    try {
      const response = await fetch("http://127.0.0.1:8000/synthesize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to upload image to server.");

      const data = await response.json();

      if (data.svg) {
        const parser = new DOMParser();
        const document = parser.parseFromString(data.svg, "image/svg+xml");

        const svg = document.querySelector("svg")!;
        const rect = svg.querySelector("rect")!;

        // fix sizing and remove background rect
        svg.setAttribute("width", rect.getAttribute("width")!);
        svg.setAttribute("height", rect.getAttribute("height")!);
        svg.removeChild(rect);

        // convert SVG back to a string
        const cleanSvgString = new XMLSerializer().serializeToString(svg);

        setSvgContent(cleanSvgString);
        convertToPolylines(cleanSvgString);

        setHasResult(false);
      } else {
        throw new Error("SVG generation failed.");
      }
    } catch (err) {
      setError(`Upload error: ${(err as Error).message}`);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResultData(e.target.value); // Update resultData when the user types
  };

  return (
    <div className="container">
      <div className="top-right">
        <h2>Two Step</h2>
        <Switch
          onChange={() => setTwoStep(!twoStep)}
          checked={twoStep}
          onColor="#ff4500"
        ></Switch>

        <button
          className="button connect-button"
          onClick={connectionStatus === "Connected" ? disconnect : connect}
        >
          {connectionStatus === "Connected" ? "Disconnect" : "Connect"}
        </button>
      </div>

      <div className="top-left">
        <h2>Username</h2>
        <input
          className="username-input"
          type="text"
          maxLength={12}
          value={username}
          onChange={(e) => setUsername(e.target.value.trim())}
        />

        <button
          className="button sample-button"
          onClick={() => {
            if (username === "") {
              alert("A username is needed to sample your handwriting!");
              return;
            }
            navigate(`/sampler?username=${username}`);
          }}
        >
          Sample My Handwriting
        </button>
      </div>

      <h1>The Homework Machine</h1>

      <div className="innerContainer">
        {!hasResult ? (
          <div className="webcamContainer">
            <Webcam
              className="webcam"
              audio={false}
              ref={webcamRef}
              forceScreenshotSourceSize
              screenshotFormat="image/png"
            />
            {countdown !== 0 && (
              <div className="countdown-overlay">
                <h1>{countdown}</h1>
              </div>
            )}
          </div>
        ) : (
          <div className="resultContainer">
            <textarea
              className="resultTextarea"
              value={resultData}
              onChange={handleTextareaChange} // Add onChange here
            />
          </div>
        )}
        {blotReady && (
          <button
            className="buttonDoHomework"
            onClick={hasResult ? synthesizeAndPrint : capture}
          >
            {twoStep ? (hasResult ? "Print" : "Capture") : "Do Homework"}
          </button>
        )}
      </div>
    </div>
  );
};

export default Home;
