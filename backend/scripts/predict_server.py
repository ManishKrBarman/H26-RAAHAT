"""
predict_server.py — Legacy Launcher (DEPRECATED)

The prediction server has moved to:  model/predict.py

To start the prediction server:
    cd <project_root>/model
    pip install -r requirements.txt
    python predict.py

The server will start at http://0.0.0.0:8000

This file is kept for backward compatibility.
It simply launches the new FastAPI server.
"""

import os
import sys
import subprocess

if __name__ == "__main__":
    # Resolve the new predict.py location
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_dir = os.path.join(project_root, "model")
    predict_script = os.path.join(model_dir, "predict.py")

    if not os.path.exists(predict_script):
        print(f"❌ Cannot find {predict_script}")
        print("   Make sure the model/ directory exists with predict.py")
        sys.exit(1)

    print(f"🔄 Launching prediction server from: {model_dir}")
    print(f"   → python {predict_script}")
    print()

    subprocess.run(
        [sys.executable, predict_script],
        cwd=model_dir,
    )
