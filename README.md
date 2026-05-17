# Portfolio CMS

A full-stack portfolio content management system — server-rendered with EJS, backed by MongoDB Atlas, with session-based auth, three-tier RBAC, and a project image upload pipeline.

Built solo for a BCIT course. The spec defined the feature list — every architectural decision (data model, middleware stack, audit logging) was mine to figure out.

---

## What's interesting about it

- **Three-tier RBAC with custom middleware.** `USER`, `MODERATOR`, and `ADMIN` roles with distinct permission sets enforced by route-level middleware in `src/middleware/auth.js`. Moderators can read contacts and toggle read state, but cannot delete or touch any other resource. Admins get full CMS access except they cannot delete their own account.

- **Session-based auth via Passport.js + bcrypt.** Passwords are hashed with bcrypt before storage. Sessions are persisted to MongoDB via `connect-mongo` so they survive server restarts. Passport's local strategy handles the login flow.

- **Image upload pipeline with featured/gallery management.** Multer handles multipart uploads; files land in `public/uploads/` and paths are stored in MongoDB as site-root relative strings. Each project can have one featured image (used as the hero and card thumbnail) and any number of gallery images. Admins can promote any gallery image to featured or delete images individually.

- **Safe-delete guards on referenced data.** Attempting to delete a category that has projects referencing it returns a JSON error instead of orphaning records. The admin UI disables the delete button when the reference count is non-zero.

- **Security audit logging on access denials.** Any request that hits an insufficient-privilege check is logged with timestamp, user ID, role, HTTP method, path, required role, and best-effort IP. This gives a traceable record of unauthorized access attempts without reaching for a third-party service.

- **Dual rendering modes.** HTML routes serve server-rendered EJS views; a parallel `/api/*` namespace returns JSON for the same data, with consistent 404 handling (JSON 404 for unknown API routes, HTML 404 page otherwise).

---

## Tech stack

Auth via Passport + bcrypt with session persistence to MongoDB. Image handling via Multer. Server-rendered EJS with a parallel JSON API.

---

## Running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env`

```env
MONGODB_URI="YOUR_ATLAS_CONNECTION_STRING"
MONGODB_DB_NAME="node-a04"
SESSION_SECRET="YOUR_SESSION_SECRET"

PERSONAL_ADMIN_EMAIL="YOUR_PERSONAL_ADMIN_EMAIL"
PERSONAL_ADMIN_NICKNAME="YOUR_PERSONAL_ADMIN_NICKNAME"
PERSONAL_ADMIN_PASSWORD="YOUR_PERSONAL_ADMIN_PASSWORD"

TEST_USER_EMAIL="YOUR_TEST_USER_EMAIL"
TEST_USER_NICKNAME="YOUR_TEST_USER_NICKNAME"
TEST_USER_PASSWORD="YOUR_TEST_USER_PASSWORD"

TEST_MODERATOR_EMAIL="YOUR_TEST_MODERATOR_EMAIL"
TEST_MODERATOR_NICKNAME="YOUR_TEST_MODERATOR_NICKNAME"
TEST_MODERATOR_PASSWORD="YOUR_TEST_MODERATOR_PASSWORD"

TEST_ADMIN_EMAIL="YOUR_TEST_ADMIN_EMAIL"
TEST_ADMIN_NICKNAME="YOUR_TEST_ADMIN_NICKNAME"
TEST_ADMIN_PASSWORD="YOUR_TEST_ADMIN_PASSWORD"
```

Do not commit `.env`. It should be in `.gitignore`.

### 3. MongoDB Atlas setup

- Create a cluster and database user
- Add your IP to the access list (or use `0.0.0.0/0` for development)
- Paste the connection string into `.env`

### 4. Import project data and seed users

```bash
npm run import-projects   # imports data/projects.json into MongoDB
npm run seed-users        # creates one ADMIN, one MODERATOR, two test accounts
```

### 5. Run

```bash
npm run dev
```

App runs at `http://localhost:3000/`

---

## Data model

### User (`users`)
| Field | Type | Notes |
|---|---|---|
| `email` | string | required, unique |
| `nickname` | string | required |
| `passwordHash` | string | bcrypt hash |
| `role` | `"USER"` \| `"MODERATOR"` \| `"ADMIN"` | required |
| `lastLogin` | Date | |

### Category (`categories`)
| Field | Type | Notes |
|---|---|---|
| `name` | string | required |
| `slug` | string | required, unique, URL-safe |
| `description` | string | optional |

### Project (`projects`)
| Field | Type | Notes |
|---|---|---|
| `slug` | string | required, unique, URL-safe |
| `title` | string | required |
| `description` | string | required |
| `isActive` | boolean | controls public visibility |
| `tags` | `[{ name }]` | embedded array |
| `categoryId` | ObjectId | ref Category |
| `tagline` | string | optional |
| `stack` | string[] | optional |
| `images` | `[{ path, alt, type, isFeatured }]` | embedded array |
| `dates.created` | Date | |
| `dates.updated` | Date | |

### Contact (`contacts`)
| Field | Type | Notes |
|---|---|---|
| `name` | string | required |
| `email` | string | required |
| `message` | string | required |
| `postedDate` | Date | required |
| `isRead` | boolean | default false |

---

## Routes

### Auth
- `GET /auth/login` · `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/register` · `POST /auth/register` (creates `USER` role)

### Public
- `GET /` · `/about` · `/contact` · `POST /contact`
- `GET /projects` — supports `?q=`, `?tag=`, and combined
- `GET /projects/category/:slug`
- `GET /projects/:slug` — active projects only

### Admin — MODERATOR + ADMIN
- `GET /admin`
- `GET /admin/contacts`
- `PATCH /admin/contacts/:id/read`

### Admin — ADMIN only
- `DELETE /admin/contacts/:id`
- Full CRUD: `/admin/categories`, `/admin/projects`, `/admin/users`
- Image routes: upload featured/gallery images, set featured, delete

### API (JSON)
- `GET /api/projects` — active only, supports `?q=` and `?tag=`
- `GET /api/projects/:id`
- `GET /api/projects/category/:slug`
- `GET /api/categories`

---

## Project structure

```
/data
  projects.json

/public
  /css/styles.css
  /images/
  /js/main.js
  /js/admin.js
  /uploads/

/scripts
  import-projects.js
  seed-users.js

/src
  /config
    passport.js
  /lib
    mongo.js
    projects.repository.js
  /middleware
    auth.js
  /models
    Category.js  Contact.js  Project.js  User.js
  /routes
    admin.routes.js  api.routes.js  auth.routes.js  pages.routes.js

/views
  /admin
    contacts/  categories/  projects/  users/
  /auth
    login.ejs  register.ejs
  /layouts
    layout-full.ejs  layout-sidebar.ejs
  /partials
    nav.ejs  footer.ejs  project-card.ejs

server.js  package.json  .env.example
```

---

## Attribution

Built on the Node2Know starter materials by **Joshua Solomon** (Node2Know-LEARN-1.0). The starter provided the project scaffold; auth, RBAC, image management, and all data models were added as part of this assignment.
