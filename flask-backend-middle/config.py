class Config:
    username = "postgres"
    password = "root"
    host = "127.0.0.1"
    port = 5432
    database = "flask-backend-middle-db"
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://{username}:{password}@{host}:{port}/{database}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = "c8ae9051-783d-429b-97a0-c434b8c10472"
