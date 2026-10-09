"""Long-form explainer films: one narrated idea per segment, evidence on screen, recall checks between.

A film is `media/explainers/<slug>/film.json`. `narrate.py` speaks it with the author's synthesized
voice (GPU), `figures.py` draws the evidence marks, `plate.py` draws the scale field behind them
(GLSL on the GPU), and `render.py` joins them into the MP4, captions and `film.receipt.json`.
"""
