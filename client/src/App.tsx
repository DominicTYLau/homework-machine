import { useEffect, useState } from "react";
import { createHTMLDocument } from "svgdom";

import { toolkit } from "./blot/src/drawingToolkit/toolkit.js";
import { createHaxidraw } from "./blot/src/haxidraw/createHaxidraw.js";
import { createWebSerialBuffer } from "./blot/src/haxidraw/createWebSerialBuffer.js";

import "./App.css";

let haxidraw: any = null;
let connected = false;

const App = () => {
  const [text, setText] = useState("");
  const [polylines, setPolylines] = useState(null);
  const [svgContent, setSvgContent] = useState("");
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");

  function handleTextChange(event: React.ChangeEvent<HTMLInputElement>) {
    setText(event.target.value);
  }

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

  // Disconnect on component mount
  useEffect(() => {
    disconnect();
  }, []);

  function debug() {
    console.log(
      convertToPolylines(`<?xml version="1.0" encoding="utf-8" ?>
<svg baseProfile="full" height="100%" version="1.1" viewBox="0,0,120,120" width="100%" xmlns="http://www.w3.org/2000/svg" xmlns:ev="http://www.w3.org/2001/xml-events" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs />
  <rect fill="white" height="120" width="120" x="0" y="0" />
  <path d="M 689.34,418.09 C 688.34 419.47, 688.10 421.17, 686.98 425.64 C 685.86 430.12, 685.41 433.03, 683.74 440.45 C 682.07 447.87, 681.10 452.86, 678.63 462.73 C 676.15 472.61, 674.49 478.48, 671.36 489.83 C 668.23 501.17, 666.33 507.80, 662.98 519.45 C 659.62 531.10, 657.62 537.62, 654.58 548.08 C 651.53 558.53, 649.93 563.91, 647.75 571.74 C 645.56 579.56, 644.12 582.91, 643.65 587.22 C 643.19 591.53, 643.89 592.92, 645.44 593.30 C 646.99 593.68, 648.56 592.57, 651.40 589.11 C 654.25 585.66, 655.64 582.32, 659.65 576.03 C 663.66 569.74, 666.30 565.27, 671.45 557.65 C 676.61 550.04, 679.73 545.42, 685.42 537.95 C 691.11 530.48, 694.36 526.37, 699.88 520.29 C 705.40 514.22, 708.38 511.33, 713.02 507.57 C 717.66 503.82, 720.03 502.73, 723.09 501.54 C 726.14 500.34, 726.75 500.39, 728.28 501.60 C 729.80 502.81, 730.20 503.81, 730.71 507.60 C 731.22 511.38, 731.44 514.44, 730.81 520.53 C 730.18 526.62, 729.20 530.74, 727.55 538.05 C 725.89 545.36, 724.40 549.81, 722.53 557.08 C 720.67 564.34, 719.39 568.48, 718.22 574.36 C 717.04 580.24, 716.76 582.81, 716.68 586.49 C 716.60 590.18, 717.23 591.54, 717.82 592.79 C 718.41 594.03, 719.16 593.92, 719.65 592.71 C 720.14 591.49, 719.89 590.26, 720.26 586.72 C 720.64 583.18, 720.49 580.77, 721.54 574.99 C 722.60 569.22, 723.69 565.08, 725.52 557.84 C 727.35 550.60, 728.90 546.16, 730.70 538.79 C 732.51 531.42, 733.71 527.35, 734.55 520.97 C 735.39 514.60, 735.71 511.43, 734.90 506.93 C 734.09 502.43, 733.13 500.25, 730.51 498.48 C 727.90 496.72, 725.70 496.76, 721.82 498.13 C 717.95 499.49, 715.89 501.22, 711.13 505.32 C 706.37 509.42, 703.55 512.39, 698.02 518.62 C 692.49 524.85, 689.26 528.98, 683.49 536.48 C 677.73 543.97, 674.53 548.55, 669.19 556.09 C 663.85 563.62, 660.98 568.00, 656.80 574.15 C 652.61 580.30, 650.52 583.27, 648.28 586.85 C 646.04 590.44, 645.90 591.89, 645.58 592.06 C 645.25 592.23, 645.77 591.66, 646.66 587.71 C 647.55 583.77, 648.06 580.16, 650.02 572.34 C 651.97 564.52, 653.49 559.08, 656.44 548.61 C 659.38 538.13, 661.37 531.60, 664.74 519.95 C 668.10 508.30, 670.02 501.68, 673.26 490.36 C 676.50 479.03, 678.24 473.17, 680.93 463.34 C 683.62 453.50, 684.77 448.54, 686.70 441.17 C 688.63 433.81, 689.52 431.01, 690.58 426.52 C 691.64 422.03, 692.24 420.43, 691.99 418.74 C 691.75 417.05, 690.35 416.71, 689.34 418.09" style="stroke: black; fill: black"></path>
  <path d="M 802.33,500.28 C 801.36 501.16, 801.13 502.10, 800.12 505.17 C 799.11 508.24, 798.77 510.47, 797.28 515.62 C 795.79 520.78, 794.57 524.27, 792.66 530.95 C 790.75 537.63, 789.47 541.86, 787.72 549.04 C 785.96 556.22, 784.83 560.29, 783.88 566.83 C 782.93 573.36, 782.31 576.68, 782.95 581.70 C 783.60 586.73, 784.23 589.27, 787.10 591.93 C 789.96 594.59, 792.50 595.38, 797.30 594.99 C 802.09 594.61, 804.75 593.36, 811.06 590.00 C 817.37 586.65, 821.32 583.93, 828.84 578.22 C 836.37 572.51, 840.80 568.57, 848.69 561.47 C 856.57 554.37, 861.00 549.86, 868.26 542.70 C 875.52 535.55, 879.29 531.48, 884.99 525.70 C 890.68 519.91, 893.21 517.28, 896.73 513.77 C 900.25 510.25, 901.68 509.23, 902.59 508.13 C 903.51 507.03, 902.34 506.53, 901.30 508.26 C 900.27 509.98, 899.47 511.96, 897.42 516.75 C 895.37 521.54, 893.79 525.25, 891.04 532.21 C 888.29 539.18, 886.30 543.89, 883.68 551.56 C 881.06 559.23, 879.49 563.75, 877.94 570.56 C 876.38 577.37, 875.93 580.64, 875.91 585.62 C 875.90 590.60, 876.59 592.68, 877.87 595.48 C 879.15 598.27, 880.62 598.76, 882.31 599.60 C 884.01 600.44, 885.48 600.05, 886.35 599.67 C 887.21 599.28, 887.09 598.24, 886.65 597.65 C 886.21 597.07, 885.03 597.55, 884.14 596.74 C 883.25 595.92, 883.12 595.83, 882.20 593.58 C 881.28 591.34, 879.77 590.00, 879.52 585.53 C 879.27 581.06, 879.53 577.82, 880.94 571.23 C 882.35 564.64, 883.88 560.10, 886.57 552.58 C 889.26 545.05, 891.43 540.43, 894.40 533.61 C 897.37 526.78, 899.33 523.35, 901.42 518.46 C 903.50 513.56, 904.82 511.62, 904.82 509.12 C 904.82 506.62, 903.50 505.46, 901.44 505.94 C 899.37 506.42, 898.12 507.89, 894.48 511.50 C 890.84 515.11, 888.78 518.07, 883.22 524.00 C 877.67 529.93, 873.93 533.99, 866.73 541.15 C 859.52 548.32, 855.08 552.81, 847.20 559.81 C 839.32 566.81, 834.83 570.67, 827.31 576.16 C 819.80 581.64, 815.70 584.19, 809.63 587.23 C 803.56 590.27, 800.96 590.98, 796.98 591.36 C 792.99 591.75, 791.81 591.17, 789.71 589.15 C 787.62 587.13, 787.01 585.64, 786.49 581.27 C 785.96 576.89, 786.23 573.57, 787.09 567.28 C 787.96 560.99, 789.01 556.87, 790.82 549.82 C 792.62 542.76, 793.98 538.57, 796.12 532.00 C 798.25 525.44, 799.66 522.07, 801.48 516.98 C 803.30 511.89, 804.52 509.79, 805.22 506.54 C 805.91 503.30, 805.52 502.01, 804.94 500.76 C 804.37 499.50, 803.29 499.40, 802.33 500.28" style="stroke: black; fill: black"></path>
  <path d="M 1000.45,386.59 C 999.34 387.61, 998.86 388.63, 997.31 392.64 C 995.75 396.65, 995.19 399.41, 992.68 406.66 C 990.16 413.90, 988.65 418.81, 984.74 428.85 C 980.82 438.89, 978.25 445.09, 973.10 456.87 C 967.96 468.64, 964.70 475.51, 959.01 487.73 C 953.32 499.95, 949.96 506.66, 944.64 517.97 C 939.33 529.29, 936.33 535.20, 932.44 544.31 C 928.55 553.42, 926.89 557.43, 925.20 563.52 C 923.51 569.62, 922.73 572.06, 924.01 574.78 C 925.29 577.51, 927.55 578.19, 931.59 577.15 C 935.62 576.10, 938.07 573.68, 944.18 569.57 C 950.28 565.47, 954.19 562.25, 962.10 556.62 C 970.01 550.99, 975.12 547.12, 983.72 541.41 C 992.31 535.70, 997.23 532.23, 1005.07 528.08 C 1012.91 523.92, 1017.08 522.28, 1022.93 520.63 C 1028.78 518.98, 1031.23 519.12, 1034.32 519.82 C 1037.40 520.52, 1037.66 521.15, 1038.34 524.13 C 1039.03 527.10, 1038.83 529.35, 1037.73 534.69 C 1036.63 540.02, 1035.20 543.99, 1032.85 550.80 C 1030.50 557.61, 1028.57 561.93, 1025.98 568.73 C 1023.39 575.52, 1021.82 579.22, 1019.90 584.79 C 1017.98 590.35, 1017.11 592.85, 1016.38 596.56 C 1015.65 600.27, 1015.82 601.50, 1016.27 603.33 C 1016.72 605.16, 1017.94 605.37, 1018.63 605.71 C 1019.32 606.05, 1019.58 605.55, 1019.74 605.02 C 1019.89 604.50, 1019.23 604.60, 1019.41 603.08 C 1019.60 601.57, 1019.89 600.89, 1020.65 597.44 C 1021.41 594.00, 1021.54 591.37, 1023.21 585.86 C 1024.88 580.35, 1026.43 576.66, 1029.01 569.88 C 1031.58 563.10, 1033.63 558.84, 1036.09 551.94 C 1038.56 545.05, 1040.19 541.19, 1041.35 535.42 C 1042.50 529.66, 1043.12 526.87, 1041.87 523.11 C 1040.62 519.36, 1039.04 517.66, 1035.09 516.64 C 1031.15 515.62, 1028.39 516.14, 1022.16 518.01 C 1015.93 519.88, 1011.90 521.70, 1003.96 526.00 C 996.01 530.29, 991.12 533.79, 982.44 539.48 C 973.77 545.16, 968.58 548.95, 960.58 554.44 C 952.58 559.94, 948.45 563.05, 942.44 566.94 C 936.43 570.83, 933.67 572.54, 930.50 573.91 C 927.34 575.27, 927.19 575.70, 926.61 573.75 C 926.04 571.81, 926.10 569.92, 927.63 564.18 C 929.16 558.45, 930.54 554.16, 934.25 545.06 C 937.96 535.97, 940.93 530.01, 946.18 518.69 C 951.43 507.36, 954.79 500.65, 960.51 488.44 C 966.23 476.22, 969.51 469.36, 974.78 457.61 C 980.05 445.86, 982.70 439.68, 986.85 429.70 C 991.00 419.72, 992.71 414.85, 995.52 407.71 C 998.34 400.57, 999.46 398.02, 1000.92 393.99 C 1002.37 389.96, 1002.91 389.02, 1002.81 387.54 C 1002.72 386.06, 1001.55 385.57, 1000.45 386.59" style="stroke: black; fill: black"></path>
  <path d="M 1161.98,418.91 C 1163.08 419.01, 1163.65 418.67, 1165.56 417.59 C 1167.47 416.50, 1168.30 415.20, 1171.51 413.51 C 1174.72 411.81, 1177.09 410.46, 1181.61 409.12 C 1186.12 407.78, 1189.02 407.23, 1194.08 406.80 C 1199.14 406.37, 1202.15 406.40, 1206.90 406.98 C 1211.66 407.55, 1214.21 408.18, 1217.85 409.68 C 1221.48 411.18, 1223.12 412.15, 1225.09 414.49 C 1227.05 416.82, 1227.57 417.97, 1227.67 421.36 C 1227.77 424.75, 1227.74 426.62, 1225.59 431.42 C 1223.44 436.23, 1221.59 439.27, 1216.92 445.40 C 1212.25 451.53, 1208.69 455.15, 1202.23 462.07 C 1195.76 468.99, 1191.43 472.92, 1184.59 479.99 C 1177.75 487.07, 1173.64 490.82, 1168.02 497.46 C 1162.41 504.09, 1159.71 507.25, 1156.51 513.16 C 1153.31 519.07, 1152.27 521.94, 1152.01 527.00 C 1151.76 532.05, 1152.51 534.50, 1155.25 538.44 C 1157.99 542.37, 1160.50 544.08, 1165.71 546.68 C 1170.93 549.28, 1175.12 550.01, 1181.34 551.43 C 1187.56 552.86, 1191.45 553.22, 1196.82 553.79 C 1202.19 554.35, 1205.87 554.71, 1208.19 554.24 C 1210.50 553.77, 1210.58 552.23, 1208.40 551.42 C 1206.21 550.61, 1202.50 550.93, 1197.26 550.19 C 1192.01 549.46, 1188.17 549.10, 1182.18 547.75 C 1176.19 546.39, 1172.13 545.67, 1167.30 543.41 C 1162.48 541.14, 1160.49 539.68, 1158.05 536.42 C 1155.61 533.17, 1154.95 531.54, 1155.11 527.14 C 1155.28 522.74, 1155.93 520.05, 1158.88 514.42 C 1161.82 508.79, 1164.37 505.55, 1169.85 498.99 C 1175.32 492.43, 1179.42 488.65, 1186.26 481.61 C 1193.10 474.57, 1197.45 470.67, 1204.05 463.79 C 1210.64 456.92, 1214.28 453.39, 1219.25 447.22 C 1224.21 441.06, 1226.33 438.15, 1228.87 432.96 C 1231.40 427.77, 1231.99 425.55, 1231.94 421.28 C 1231.89 417.01, 1231.10 414.75, 1228.62 411.61 C 1226.13 408.48, 1223.77 407.38, 1219.53 405.62 C 1215.28 403.86, 1212.56 403.45, 1207.41 402.82 C 1202.26 402.19, 1199.19 402.20, 1193.78 402.48 C 1188.37 402.77, 1185.36 403.16, 1180.36 404.25 C 1175.36 405.34, 1172.51 406.23, 1168.78 407.94 C 1165.06 409.65, 1163.48 410.96, 1161.74 412.79 C 1159.99 414.63, 1160.00 415.88, 1160.05 417.10 C 1160.10 418.33, 1160.88 418.81, 1161.98 418.91" style="stroke: black; fill: black"></path>
  <path d="M 1165.98,615.28 C 1167.02 614.85, 1167.10 613.93, 1167.00 613.28 C 1166.91 612.63, 1166.24 612.47, 1165.50 612.03 C 1164.77 611.59, 1164.28 610.99, 1163.31 611.07 C 1162.34 611.16, 1160.95 611.58, 1160.66 612.45 C 1160.37 613.32, 1160.77 614.85, 1161.84 615.41 C 1162.90 615.98, 1164.95 615.70, 1165.98 615.28" style="stroke: black; fill: black"></path>
</svg>
`)
    );
  }

  return (
    <div className={`app-container ${isHighContrast ? "high-contrast" : ""}`}>
      <div className="top-right-toggle">
        <button
          onClick={() => setIsHighContrast(!isHighContrast)}
          className="button contrast-toggle"
        >
          Toggle {isHighContrast ? "Normal Mode" : "High Contrast Mode"}
        </button>
      </div>
      <h1
        // onDoubleClick={secret} // Attach the double-click event
        style={{ cursor: "pointer" }} // Optional: Adds a visual indicator for interactivity
      >
        Text to SVG Converter with Machine Control
      </h1>

      <input
        type="text"
        value={text}
        onChange={handleTextChange}
        placeholder="Enter text"
        className="input-field"
      />
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      <div className="button-container">
        <button
          onClick={generateSvg}
          disabled={!text}
          className="button primary-button"
        >
          Generate SVG
        </button>
        <button
          // onClick={startVoiceRecognition}
          className="button secondary-button"
          disabled={isListening}
        >
          {isListening ? "Listening..." : "Start Voice Input"}
        </button>
        <button
          className="button warning-button"
          onClick={connectionStatus === "Connected" ? disconnect : connect}
        >
          {connectionStatus === "Connected" ? "Disconnect" : "Connect"}
        </button>
        <button className="button secondary-button" onClick={debug}>
          Debug
        </button>
      </div>

      {polylines && (
        <div className="output-container">
          <h3>Generated Code:</h3>
          <pre className="code-block">
            {`const polylines = ${JSON.stringify(polylines, null, 2)};`}
          </pre>
        </div>
      )}
      {svgContent && (
        <div className="output-container">
          <h3>Generated SVG:</h3>
          <div
            className="svg-preview"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      )}
    </div>
  );
};

export default App;
