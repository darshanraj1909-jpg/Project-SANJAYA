import cv2
from ultralytics import YOLO

def run_live_detection():
    # 1. Load your custom trained model
    # If best.pt is in a different folder, provide the absolute path here
    model_path = "fire_smoke_model.pt" 
    print(f"Loading custom model from {model_path}...")
    model = YOLO(model_path)
    
    # 2. Initialize the webcam
    # '0' is typically the built-in webcam. Change to 1 or 2 if using an external USB camera.
    print("Initializing webcam stream...")
    cap = cv2.VideoCapture(0)
    
    # Check if the webcam opened correctly
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    # Set camera resolution (Optional: lower resolution = higher FPS)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    print("\n==============================================")
    print("Application Running Successfully!")
    print("-> Press 'q' on your keyboard to exit the app safely.")
    print("==============================================\n")

    while True:
        # Capture frame-by-frame from the webcam
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to grab frame.")
            break

        # 3. Run YOLO inference on the current frame
        # stream=True utilizes generator-based streaming for optimal memory management
        results = model(frame, stream=True, conf=0.4)

        # 4. Extract and draw bounding boxes on the frame
        for result in results:
            # Annotated frame automatically draws the bounding boxes and labels
            annotated_frame = result.plot()

        # 5. Display the live video feed in a native desktop window
        cv2.imshow("Real-Time Fire & Smoke Detection System", annotated_frame)

        # 6. Break the loop if the 'q' key is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # 7. Clean up and release hardware resources when closing
    print("Shutting down application and releasing camera resources...")
    cap.release()
    cv2.destroyAllWindows()
    print("Application closed safely.")

if __name__ == "__main__":
    run_live_detection()