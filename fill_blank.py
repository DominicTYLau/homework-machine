import cv2

# Load the image, uncropped
image = cv2.imread('output/paper_image.jpg')

# Get image dimensions
height, width = image.shape[:2]

# Convert to grayscale
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

# Threshold to create a binary image
thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

# Create a horizontal kernel and detect horizontal lines
horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 1))
detected_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)

# Find contours of the detected lines
cnts = cv2.findContours(detected_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
cnts = cnts[0] if len(cnts) == 2 else cnts[1]

# Function to check if a point is near the edge
def is_near_edge(point, width, height, margin=10):
    x, y = point
    return x <= margin or x >= width - margin or y <= margin or y >= height - margin

def px_to_mm(px):
    return px * 100/96 # 100mm = 96px

# Store valid points
points = []

# Loop over each contour
for c in cnts:
    # Get the bounding box for each contour
    x, y, w, h = cv2.boundingRect(c)
    
    # Calculate the start and end points of the line
    start_point = (x, y)
    end_point = (x + w, y)
    
    # Exclude points near the edge
    if not (is_near_edge(start_point, width, height) or is_near_edge(end_point, width, height)):
        points.append((start_point, end_point))
        # Draw the line on the image
        cv2.line(image, start_point, end_point, (36, 255, 12), 2)

# Sort points from left to right, top to bottom
points.sort(key=lambda p: (p[0][1], p[0][0]))  # Sort by y-coordinate first, then x-coordinate.

# Print sorted and filtered points
for start_point, end_point in points:
    print(f"Start point: {start_point}, End point: {end_point}")

# Display the results
cv2.imshow('Image with Lines', image)
cv2.waitKey(0)
cv2.destroyAllWindows()