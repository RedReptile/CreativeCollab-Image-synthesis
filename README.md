**Current Progress**

Downloaded COCO 2017 dataset (train + val) and stuff annotations.

Extracted pixel-level masks and built a custom label map for landscapes (sky, trees, mountains, rivers, roads, etc.).

**Organized dataset into SPADE format:**

datasets/landscape/
├── train_img/   ├── train_label/
├── val_img/     └── val_label/


Validation images are ready, training subset (20k–50k) is being finalized.

Colab environment set up for GPU training.

**So far**: Dataset pipeline + label mapping done.
**Next**: Finalize subset → run SPADE training → test synthesis.
