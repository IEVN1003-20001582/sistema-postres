from app import db, app
app.app_context().push()
db.drop_all()
db.create_all()
print("Database dropped and recreated successfully.")
