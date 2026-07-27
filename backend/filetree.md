project
└── manhwa-video
    ├── README.md
    ├── backend
    │   ├── Dockerfile
    │   ├── __pycache__
    │   │   └── main.cpython-313.pyc
    │   ├── api
    │   │   ├── __init__.py
    │   │   ├── __pycache__
    │   │   │   └── __init__.cpython-313.pyc
    │   │   ├── routers
    │   │   │   ├── __init__.py
    │   │   │   ├── __pycache__
    │   │   │   │   ├── __init__.cpython-313.pyc
    │   │   │   │   ├── jobs.cpython-313.pyc
    │   │   │   │   └── upload.cpython-313.pyc
    │   │   │   ├── jobs.py
    │   │   │   └── upload.py
    │   │   └── schemas
    │   │       └── __init__.py
    │   ├── core
    │   │   ├── __init__.py
    │   │   ├── __pycache__
    │   │   │   ├── __init__.cpython-313.pyc
    │   │   │   ├── celery_app.cpython-313.pyc
    │   │   │   ├── config.cpython-313.pyc
    │   │   │   └── langgraph_app.cpython-313.pyc
    │   │   ├── celery_app.py
    │   │   ├── config.py
    │   │   └── langgraph_app.py
    │   ├── db
    │   │   ├── __init__.py
    │   │   ├── __pycache__
    │   │   │   ├── __init__.cpython-313.pyc
    │   │   │   ├── supabase.cpython-313.pyc
    │   │   │   └── supabase_admin.cpython-313.pyc
    │   │   ├── supabase.py
    │   │   └── supabase_admin.py
    │   ├── docker-compose.yml
    │   ├── filetree.md
    │   ├── main.py
    │   ├── requirements.txt
    │   ├── services
    │   │   └── __init__.py
    │   ├── tests
    │   │   └── __init__.py
    │   ├── utils
    │   │   └── __init__.py
    │   ├── workers
    │   │   ├── __init__.py
    │   │   ├── __pycache__
    │   │   │   ├── __init__.cpython-313.pyc
    │   │   │   └── tasks.cpython-313.pyc
    │   │   └── tasks.py
    │   └── yolov8n.pt
    └── frontend
        ├── eslint.config.js
        ├── index.html
        ├── package-lock.json
        ├── package.json
        ├── public
        │   ├── Anurag.jpeg
        │   ├── SubhroDp.png
        │   ├── Web_App_Demo_Video_Generation.mp4
        │   ├── about.mp4
        │   ├── bgAnimation-fallback.jpg
        │   ├── bgAnimation.mp4
        │   ├── luffy.png
        │   ├── luffy.svg
        │   ├── manhwa-logo.png
        │   ├── video1.mp4
        │   ├── video2.mp4
        │   ├── video3.mp4
        │   └── vite.svg
        ├── src
        │   ├── App.css
        │   ├── App.jsx
        │   ├── api
        │   │   └── api.js
        │   ├── assets
        │   │   └── react.svg
        │   ├── components
        │   │   ├── ScrollonTop.jsx
        │   │   ├── SupabaseTest.jsx
        │   │   ├── auth
        │   │   │   └── AuthCallback.jsx
        │   │   └── home
        │   │       ├── AboutSection.jsx
        │   │       ├── AnimatedBackground.jsx
        │   │       ├── CTASection.jsx
        │   │       ├── FeaturesSection.jsx
        │   │       ├── HeroSection.jsx
        │   │       ├── PricingSection.jsx
        │   │       ├── StatsSection.jsx
        │   │       └── VideoCarousel.jsx
        │   ├── context
        │   │   └── AuthContext.jsx
        │   ├── index.css
        │   ├── layout
        │   │   ├── CursorGlow.jsx
        │   │   ├── Footer.jsx
        │   │   └── Header.jsx
        │   ├── lib
        │   │   └── supabaseClient.js
        │   ├── main.jsx
        │   ├── pages
        │   │   ├── Contact.jsx
        │   │   ├── Documentation.jsx
        │   │   ├── Home.jsx
        │   │   ├── Login.jsx
        │   │   ├── NotFound.jsx
        │   │   └── Upload.jsx
        │   ├── routing
        │   │   └── Routing.jsx
        │   └── utils
        │       ├── toast.js
        │       └── videoMaker.js
        ├── vercel.json
        └── vite.config.js