.PHONY: dev backend-dev frontend-dev backend-install frontend-install prisma-gen prisma-migrate seed

backend-install:
	cd backend && pip install -r requirements.txt

frontend-install:
	cd frontend && npm install

prisma-gen:
	cd backend && python -m prisma generate

prisma-migrate:
	cd backend && python -m prisma migrate deploy

seed:
	cd backend && python seed.py

backend-dev:
	cd backend && ./prestart.sh && venv/bin/uvicorn main:app --reload

frontend-dev:
	cd frontend && npm run dev

dev:
	( cd backend && ./prestart.sh && venv/bin/uvicorn main:app --reload ) & \
	( cd frontend && npm run dev ) & \
	wait
