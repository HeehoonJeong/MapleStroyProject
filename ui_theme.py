import streamlit as st


def apply_maple_theme() -> None:
    st.markdown(
        """
        <style>
        :root {
            --maple-canvas: #000000;
            --maple-surface: #0d0d0d;
            --maple-card: #141414;
            --maple-elevated: #1f1f1f;
            --maple-white: #ffffff;
            --maple-body: #cccccc;
            --maple-muted: #999999;
            --maple-hairline: #262626;
            --maple-hairline-strong: #3a3a3a;
            --maple-link: #c3d9f3;
            --maple-display: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            --maple-text: "Iowan Old Style", "Noto Serif KR", "Batang", "Times New Roman", serif;
            --maple-mono: ui-monospace, "SF Mono", "Cascadia Mono", monospace;
        }
        .stApp, [data-testid="stAppViewContainer"] { background: var(--maple-canvas); color: var(--maple-white); }
        [data-testid="stHeader"] { background: rgba(0, 0, 0, .94); }
        .block-container { max-width: 1280px; padding: 1.25rem 2.5rem 5rem; }
        [data-testid="stSidebar"] { background: var(--maple-surface); border-right: 1px solid var(--maple-hairline); }
        [data-testid="stSidebar"] * { color: var(--maple-body); }
        [data-testid="stSidebarNav"] a { font-family: var(--maple-mono); font-size: .75rem; letter-spacing: .10em; text-transform: uppercase; }
        [data-testid="stSidebarNav"] span[label="app"] [data-testid="stMarkdownContainer"] p { font-size: 0; }
        [data-testid="stSidebarNav"] span[label="app"] [data-testid="stMarkdownContainer"] p::after { content: "MAPLE / AI"; color: var(--maple-white); font-family: var(--maple-display); font-size: .8rem; letter-spacing: .38em; }
        [data-testid="stSidebarNav"] a[aria-current="page"] { background: transparent; border-left: 1px solid var(--maple-white); color: var(--maple-white) !important; }
        .maple-wordmark { margin: .4rem 0 1rem; color: var(--maple-white) !important; opacity: 1 !important; font-family: var(--maple-display); font-size: .9rem; font-weight: 400; letter-spacing: .48em; text-transform: uppercase; }
        .maple-flow-note { display: flex; flex-direction: column; gap: .5rem; min-height: 5rem; justify-content: center; padding: .75rem 0; border-top: 1px solid var(--maple-hairline); border-bottom: 1px solid var(--maple-hairline); color: var(--maple-body); }
        .maple-flow-note .eyebrow, .maple-feature-summary .eyebrow { color: var(--maple-muted); font-family: var(--maple-mono); font-size: .68rem; letter-spacing: .16em; text-transform: uppercase; }
        .maple-feature-summary { padding: 1.25rem 1.5rem; border: 1px solid var(--maple-hairline); background: var(--maple-surface); color: var(--maple-body); }
        .maple-feature-summary .description { margin-top: .55rem; font-family: var(--maple-text); line-height: 1.6; }
        h1, h2, h3 {
            color: var(--maple-white) !important;
            font-family: var(--maple-display) !important;
            font-weight: 400 !important;
            letter-spacing: .10em !important;
            line-height: 1.2 !important;
            text-transform: uppercase;
        }
        h1 { font-size: clamp(2rem, 5vw, 4rem) !important; letter-spacing: .12em !important; }
        h2 { font-size: clamp(1.5rem, 3.2vw, 2.5rem) !important; }
        h3 { font-size: clamp(1.15rem, 2.4vw, 1.8rem) !important; }
        p, li, [data-testid="stMarkdownContainer"] { color: var(--maple-body); font-family: var(--maple-text); line-height: 1.65; }
        [data-testid="stCaptionContainer"], label, small {
            color: var(--maple-muted) !important;
            font-family: var(--maple-mono) !important;
            font-size: .72rem !important;
            letter-spacing: .12em !important;
            line-height: 1.6;
            text-transform: uppercase;
        }
        [data-testid="stChatMessage"] { background: transparent; border: 0; border-bottom: 1px solid var(--maple-hairline); border-radius: 0; padding: 1.25rem 0; }
        [data-testid="stExpander"] { background: transparent; border: 1px solid var(--maple-hairline); border-radius: 0; }
        [data-testid="stExpander"] summary { color: var(--maple-white); font-family: var(--maple-display); font-weight: 400; letter-spacing: .035em; }
        [data-testid="stVerticalBlockBorderWrapper"] { border-color: var(--maple-hairline) !important; border-radius: 0 !important; background: var(--maple-canvas); }
        [data-testid="stImage"] img { border-radius: 0 !important; }
        [data-testid="stFileUploader"] { background: var(--maple-surface); border: 1px solid var(--maple-hairline-strong); border-radius: 0; }
        [data-testid="stStatusWidget"] { background: var(--maple-surface); border: 1px solid var(--maple-hairline); border-radius: 0; }
        [data-testid="stAlert"] { background: var(--maple-surface); color: var(--maple-body); border: 1px solid var(--maple-hairline); border-radius: 0; }
        [data-testid="stAlert"] svg { display: none; }
        .stButton > button {
            min-height: 44px;
            padding: .75rem 2rem;
            color: var(--maple-white) !important;
            background: transparent !important;
            border: 1px solid var(--maple-white) !important;
            border-radius: 9999px !important;
            font-family: var(--maple-mono) !important;
            font-size: .78rem !important;
            font-weight: 400 !important;
            letter-spacing: .14em !important;
            text-transform: uppercase;
            box-shadow: none !important;
        }
        [data-baseweb="select"] > div { background: var(--maple-canvas) !important; color: var(--maple-white); border: 0; border-bottom: 1px solid var(--maple-hairline-strong); border-radius: 0; }
        [role="listbox"], [role="option"] { color: var(--maple-white); background: var(--maple-card); }
        input, textarea { color: var(--maple-white) !important; background: transparent !important; border: 0 !important; border-bottom: 1px solid var(--maple-hairline-strong) !important; border-radius: 0 !important; }
        input:focus, textarea:focus { border-bottom: 1px solid var(--maple-white) !important; box-shadow: none !important; }
        [data-testid="stChatInput"] { background: var(--maple-canvas); border-top: 1px solid var(--maple-hairline); }
        [data-testid="stChatInput"] textarea { background: transparent !important; }
        [data-testid="stFileUploaderDropzone"] { background: var(--maple-canvas) !important; border: 1px solid var(--maple-hairline-strong) !important; border-radius: 0 !important; }
        a { color: var(--maple-link) !important; text-decoration: underline; text-underline-offset: 3px; }
        hr { border-color: var(--maple-hairline); }
        @media (max-width: 768px) {
            .block-container { padding: 1rem 1rem 3rem; }
            h1 { letter-spacing: .07em !important; }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
