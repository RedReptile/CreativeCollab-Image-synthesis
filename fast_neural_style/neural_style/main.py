import streamlit as st
from PIL import Image

import style
st.title("Neural Style Transfer")

img = st.sidebar.selectbox(
    'Select an image to stylize',
    ('amber.jpg', 'cat.jpg')
)

style_name = st.sidebar.selectbox(
    'Select a style model',
    ('floral', 'mosaic', 'oilpaint', 'cubism')
)

model = "neural_style/saved_models/" + style_name + ".pth"
input_image = "neural_style/images/content-images/" + img
output_image = "neural_style/images/ouput-images" + style_name + "_" + img

st.write("Input Image:")
image = Image.open(input_image)
st.image(image, width=300)

clicked = st.button("Stylize Image")

if clicked:
    model = style.load_model(model)
    style.stylize(model, input_image, output_image)

    st.write("Output Image:")
    image = Image.open(output_image)
    st.image(image, width=300)