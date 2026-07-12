import cv2
from ultralytics import YOLO

# 1. Load your trained model. 
# You can use the standard best.pt or the newly converted best.tflite
# Make sure to put the actual path to where you saved the file on your computer.
model_path = "best.pt" 
model = YOLO(model_path)

# 2. Initialize the webcam. 
# '0' is usually your laptop's built-in webcam. 
# If you have an external USB camera plugged in, you might need to change it to '1' or '2'.
cap = cv2.VideoCapture(0)

print("Starting live video feed... Press 'q' to quit.")

while cap.isOpened():
    # Read a frame from the webcam
    success, frame = cap.read()
    
    if success:
        # 3. Run YOLO inference on the live frame
        # conf=0.5 ensures it only shows boxes it is at least 50% confident about
        results = model(frame, conf=0.5, verbose=False)
        
        # 4. Draw the bounding boxes and labels on the frame
        annotated_frame = results[0].plot()
        
        # 5. Display the frame in a window
        cv2.imshow("Patient Posture Live Test", annotated_frame)
        
        # 6. Break the loop if the user presses 'q'
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break
    else:
        print("Failed to grab frame from camera. Exiting...")
        break

# Clean up and close windows
cap.release()
cv2.destroyAllWindows()

