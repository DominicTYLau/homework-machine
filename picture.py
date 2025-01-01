import cv2
import numpy as np
import time
import subprocess


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


def main():
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

    normal_image_path = "normal_image.jpg"
    cv2.imwrite(normal_image_path, normal_frame)
    print(f"Normal image saved as {normal_image_path}. Now introduce a piece of paper.")

    while True:
        ret, frame = camera.read()
        if not ret:
            print("Failed to read from camera.")
            break

        if detect_change(normal_frame, frame):
            print("Paper detected! Countdown to capture:")
            for i in range(10, 0, -1):
                print(i)
                ret, frame = camera.read()  # Continuously read from the camera
                if not ret:
                    print("Failed to read from camera.")
                    break
                cv2.imshow("Countdown to Capture", frame)  # Show live feed
                cv2.waitKey(1)  # Allow OpenCV to process window events
                time.sleep(1)  # Wait for one second

                captured_image_path = "paper_image.jpg"
                capture_image(camera, captured_image_path)
                cv2.destroyWindow("Countdown to Capture")  # Close countdown window

            # Run scan.py on the captured image
            try:
                command = [
                    "python",
                    "OpenCV-Document-Scanner/scan.py",
                    "--image",
                    captured_image_path,
                ]
                subprocess.run(command, check=True)
                print(f"Executed: {' '.join(command)}")

                # Run chatgpt.py on the captured image
                try:
                    command = ["python", "chatgpt.py"]
                    subprocess.run(command, check=True)
                    print(f"Executed: {' '.join(command)}")
                except subprocess.CalledProcessError as e:
                    print(f"Error occurred while running chatgpt.py: {e}")
            except subprocess.CalledProcessError as e:
                print(f"Error occurred while running scan.py: {e}")

            break

        cv2.imshow("Live Feed", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):  # Press 'q' to quit the program
            print("Exiting program.")
            break

    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
