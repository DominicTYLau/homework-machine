import os
import time

import cv2
import numpy as np

from scanner.scan import DocScanner
from server.file.chatgpt import query_gpt

OUTPUT_DIR = "scanner_output"


def capture_image(camera, filename):
    """Capture an image from the camera and save it to the specified file."""
    ret, frame = camera.read()
    if ret:
        cv2.imwrite(filename, frame)
        print(f"Image saved as {filename}")
    else:
        print("Failed to capture image.")


def detect_change(normal_image, current_frame, threshold=50):
    """Detects significant change between the normal image and the current frame."""
    diff = cv2.absdiff(normal_image, current_frame)
    gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray_diff, threshold, 255, cv2.THRESH_BINARY)
    change_ratio = np.sum(thresh) / (thresh.shape[0] * thresh.shape[1])
    return change_ratio > 100  # Adjust this threshold as needed


def captured_image():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"Created ${OUTPUT_DIR} directory.")

    camera = cv2.VideoCapture(0)  # Open the default camera

    if not camera.isOpened():
        print("Could not open camera.")
        return

    input("Press Enter to capture the normal picture (without paper in view).")
    ret, normal_frame = camera.read()
    if not ret:
        print("Failed to capture the normal picture.")
        camera.release()
        return

    normal_image_path = os.path.join(OUTPUT_DIR, "normal_image.jpg")
    cv2.imwrite(normal_image_path, normal_frame)
    print(f"Normal image saved as {normal_image_path}. Now introduce a piece of paper.")

    while True:
        ret, frame = camera.read()
        if not ret:
            print("Failed to read from camera.")
            break

        if detect_change(normal_frame, frame):
            print("Paper detected! Countdown to capture:")

            for i in range(5, 0, -1):
                print(i)
                ret, frame = camera.read()  # Continuously read from the camera
                if not ret:
                    print("Failed to read from camera.")
                    break
                cv2.imshow("Countdown to Capture", frame)  # Show live feed
                cv2.waitKey(1)  # Allow OpenCV to process window events
                time.sleep(1)  # Wait for one second

            captured_image_path = os.path.join(OUTPUT_DIR, "paper_image.jpg")
            capture_image(camera, captured_image_path)

            # Run scan.py on the captured image
            DocScanner(output_dir=OUTPUT_DIR).scan(captured_image_path, output_basename="processed_image.jpg")

            # Run chatgpt.py on the captured image
            # print(query_gpt())

            break