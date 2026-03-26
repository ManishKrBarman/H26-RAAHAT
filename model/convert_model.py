"""
One-time: convert raahat_audio_model.keras (Keras 3) -> .h5 (Keras 2).
Manually maps weights from the Keras 3 H5 layout to the rebuilt model.

Usage: python convert_model.py
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import zipfile
import numpy as np
import h5py
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


def convert():
    src = "raahat_audio_model.keras"
    dst = "raahat_audio_model.h5"

    # 1. Rebuild the exact architecture
    model = keras.Sequential([
        layers.InputLayer(input_shape=(128, 128, 1)),
        layers.Conv2D(32, (3, 3), activation='relu', name='conv2d'),
        layers.MaxPooling2D((2, 2), name='max_pooling2d'),
        layers.Conv2D(64, (3, 3), activation='relu', name='conv2d_1'),
        layers.MaxPooling2D((2, 2), name='max_pooling2d_1'),
        layers.Conv2D(128, (3, 3), activation='relu', name='conv2d_2'),
        layers.MaxPooling2D((2, 2), name='max_pooling2d_2'),
        layers.Flatten(name='flatten'),
        layers.Dense(128, activation='relu', name='dense'),
        layers.Dropout(0.3, name='dropout'),
        layers.Dense(3, activation='softmax', name='dense_1'),
    ], name='sequential')

    print("Model rebuilt:")
    model.summary()

    # 2. Extract weights H5 from .keras zip
    weights_h5_path = "model.weights.h5"
    with zipfile.ZipFile(src, "r") as zf:
        zf.extract(weights_h5_path, ".")

    # 3. Manually load weights from Keras 3 H5 layout
    # Keras 3 stores: layers/{layer_name}/vars/0 (kernel), vars/1 (bias)
    weight_layers = ['conv2d', 'conv2d_1', 'conv2d_2', 'dense', 'dense_1']

    with h5py.File(weights_h5_path, "r") as f:
        for layer_name in weight_layers:
            layer = model.get_layer(layer_name)
            grp = f[f"layers/{layer_name}/vars"]
            kernel = np.array(grp["0"])
            bias = np.array(grp["1"])
            layer.set_weights([kernel, bias])
            print(f"  Loaded {layer_name}: kernel={kernel.shape}, bias={bias.shape}")

    # 4. Cleanup extracted file
    try:
        os.remove(weights_h5_path)
    except Exception:
        pass

    # 5. Save as .h5
    model.save(dst)
    print(f"\nSaved -> {dst}")
    print(f"Use: load_model('{dst}', compile=False)")


if __name__ == "__main__":
    convert()
