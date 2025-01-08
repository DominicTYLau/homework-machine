import { useEffect, useState, useRef, useCallback } from "react";
import { createHTMLDocument } from "svgdom";
import Webcam from "react-webcam";


import { toolkit } from "./blot/src/drawingToolkit/toolkit.js";
import { createHaxidraw } from "./blot/src/haxidraw/createHaxidraw.js";
import { createWebSerialBuffer } from "./blot/src/haxidraw/createWebSerialBuffer.js";

import "./App.css";

let haxidraw: any = null;
let connected = false;

const App = () => {
  const [polylines, setPolylines] = useState(null);
  const [svgContent, setSvgContent] = useState("");
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");

    const [text, setText] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const webcamRef = useRef(null);


  const handleCompute = async () => {
    setCountdown(5); // Start countdown from 5
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          setCountdown(null);
          takeSnapshot(); // Take a snapshot when countdown ends
        }
        return prev! - 1;
      });
    }, 1000);
  };

  const takeSnapshot = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        // Save the image to local file (here we use download for simplicity)
        const link = document.createElement("a");
        link.href = imageSrc;
        link.download = "snapshot.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };




  async function disconnect() {
    try {
      if (haxidraw && haxidraw.port) {
        await haxidraw.port.close();
      }
    } catch (e) {
      console.error("Disconnect error:", e);
    } finally {
      haxidraw = null;
      connected = false;
      setConnectionStatus("Disconnected");
    }
  }

  function sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async function connect() {
    if (!navigator.serial) {
      alert(
        "Your browser doesn't seem to support the Web Serial API, which is required for the Blot editor to connect to the machine. Chrome Version 89 or above is the recommended browser.",
      );
    }
    if (!haxidraw) {
      // connect
      navigator.serial
        .requestPort({ filters: [] })
        .then(async (port) => {
          console.log("connecting");
          const comsBuffer = await createWebSerialBuffer(port);
          haxidraw = await createHaxidraw(comsBuffer);

          console.log(haxidraw);
          connected = true;
        })
        .catch((_) => {
          return; // The user didn't select a port.
        });
    } else {
      // disconnect
      console.log("disconnecting");
      await haxidraw.port.close();
      haxidraw = null;
      connected = false;
    }
  }

  // async function secret() {
  //   try {
  //           // Fetch the SVG content
  //       const response = await fetch(svgPath);
  //       if (!response.ok) {
  //           throw new Error(`Failed to fetch SVG: ${response.statusText}`);
  //       }
  //       const stringSvg = await response.text(); // Get SVG as a string

  //       console.log("SVG Content as String:", stringSvg);

  //       const result = toolkit.svgToPolylines(stringSvg);
  //       const resizedPolylines = toolkit.scalePolylinesToDimension(
  //         JSON.stringify(result),
  //         100,
  //         100,
  //         true
  //       );

  //       // Convert resizedPolylines to a 3D array by wrapping each 2D polyline

  //       setPolylines(resizedPolylines);

  //       const resizedPolylines3D = JSON.parse(resizedPolylines);

  //       drawNotFlipped(resizedPolylines3D);

  //       setError("");
  //     } catch (err) {
  //       setError(`Error converting SVG: ${err.message}`);
  //     }

  //     };

  async function drawNotFlipped(lines: Polylines) {
    await haxidraw.goTo(0, 0);
    // await haxidraw.servo(1700);  // pen Down
    await haxidraw.servo(1000); // pen Up

    for (let i = 0; i < lines.length; i++) {
      // Loop through the second dimension of the 3D array
      for (let j = 0; j < lines[i].length; j++) {
        let line = lines[i][j]; // Each line is an array of points

        if (j === 0) {
          await haxidraw.goTo(line[0], line[1]);
          await haxidraw.servo(1700); // pen Down
          await sleep(100);
        }

        await haxidraw.goTo(line[0], line[1]);
      }
      await haxidraw.servo(1000); // pen Up
      await sleep(75);
    }
  }
  async function draw(lines: Polylines) {
    await haxidraw.servo(1000); // pen Up
    await haxidraw.goTo(0, 0);

    for (let i = 0; i < lines.length; i++) {
      // Loop through the second dimension of the 3D array
      for (let j = 0; j < lines[i].length; j++) {
        let line = lines[i][j]; // Each line is an array of points

        await haxidraw.goTo(line[0], 125 - line[1]);

        if (j === 0) {
          await haxidraw.servo(1700); // pen Down
          await sleep(100);
        }
      }

      await haxidraw.servo(1000); // pen Up
      await sleep(150);
    }
  }

  async function convertToPolylines(svgString: string) {
    try {
      const result = toolkit.svgToPolylines(svgString);

      const resizedPolylines = toolkit.scalePolylinesToDimension(
        JSON.stringify(result),
        100,
        100,
        true,
      );

      // Convert resizedPolylines to a 3D array by wrapping each 2D polyline

      setPolylines(resizedPolylines);

      const resizedPolylines3D = JSON.parse(resizedPolylines);

      draw(resizedPolylines3D);

      setError("");
    } catch (err: any) {
      setError(`Error converting SVG: ${err.message}`);
    }
  }

  async function generateSvg() {
    try {
      const response = await fetch("http://127.0.0.1:8000/synthesize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

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
        setError("Error generating SVG");
      }
    } catch (err) {
      console.error("Error sending text to Python:", err);
      setError("Error processing text");
    }
  }

  // const startVoiceRecognition = () => {
  //   const recognition = new (window.SpeechRecognition ||
  //     window.webkitSpeechRecognition ||
  //     window.mozSpeechRecognition ||
  //     window.msSpeechRecognition)();

  //   recognition.lang = "en-US";

  //   recognition.onstart = () => setIsListening(true);
  //   recognition.onend = () => setIsListening(false);
  //   recognition.onresult = (event) => {
  //     const transcript = event.results[0][0].transcript;
  //     setText((prevText) => prevText + " " + transcript);
  //   };

  //   recognition.start();
  // };

  

  


  return (
    <div className="container">
      <div className="top-right-toggle">
        <button
          className="button warning-button"
          onClick={() => alert("Connect/Disconnect functionality")}
        >
          Connect/Disconnect
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