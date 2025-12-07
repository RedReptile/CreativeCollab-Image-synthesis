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

---

## Real-ESRGAN Upscaling API

1. Create / activate your Python environment.
2. Install the backend dependencies (includes Real-ESRGAN and FastAPI):
   ```
   pip install -r backend/requirements.txt
   ```
3. Run the FastAPI server (defaults to port 8000):
   ```
   uvicorn backend.app:app --reload --port 8000
   ```

The first upscale request for each scale will automatically download the
pretrained Real-ESRGAN weights into `backend/models/`. Keep these files out of
version control (they are already gitignored).

Set the frontend environment variable to point at the API (optional if you use
the default localhost URL):

```
REACT_APP_UPSCALE_API_URL=http://localhost:8000
```