import streamlit as st


def apply_maple_theme() -> None:
    st.markdown(
        """
        <style>
        .stApp { background: #fbf8f3; color: #2d2926; }
        [data-testid="stHeader"] { background: rgba(251, 248, 243, .92); }
        .block-container { max-width: 1120px; padding-top: 1.6rem; padding-bottom: 3rem; }
        [data-testid="stSidebar"] { background: #f1ece4; border-right: 1px solid #e7ded2; }
        h1, h2, h3 { color: #3b302b; letter-spacing: -.02em; }
        [data-testid="stChatMessage"] { border: 1px solid #eee4d8; border-radius: 16px; padding: .65rem 1rem; }
        [data-testid="stExpander"] { border: 1px solid #eadfd2; border-radius: 14px; background: #fffdf9; }
        [data-testid="stExpander"] summary:hover { color: #b84d37; }
        [data-testid="stFileUploader"] { border: 1px dashed #c96a50; border-radius: 14px; background: #fffaf4; }
        div[data-testid="stStatusWidget"] { border-radius: 12px; }
        .stButton > button { border-radius: 12px; border-color: #c65b43; transition: all .15s ease; }
        .stButton > button:hover { border-color: #a83e2a; color: #a83e2a; transform: translateY(-1px); }
        </style>
        """,
        unsafe_allow_html=True,
    )
