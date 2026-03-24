# Node A03 — Portfolio Launchpad (MongoDB Integration: Atlas + Mongoose + Mini CMS)

This project upgrades the A02 Portfolio Launchpad by replacing the file-based data source (`/data/projects.json`) with **MongoDB Atlas** accessed through **Mongoose**, and adds a minimal **Admin CMS** (no auth yet).

---

## Tech Stack
- Node.js + Express
- EJS + express-ejs-layouts (server-rendered pages)
- MongoDB Atlas
- Mongoose

---

## Setup

### 1) Install dependencies
```bash
npm install
```

### 2) Create `.env`

Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
PORT=3000
```

Important: Do not commit `.env`

### 3) Atlas checklist

In MongoDB Atlas:
- Create a cluster
- Create a database user (username/password)
- Add your current IP to the IP Access List (or temporarily allow `0.0.0.0/0` for development)

### 4) Run the app
```bash
npm run dev
```

App runs at:

- `http://localhost:3000/`

---

## Data Models (Mongoose)

### Category (`categories`)
- `name` (string, required)
- `slug` (string, required, unique, URL-safe)
- `description` (string, optional)

### Project (`projects`)
- `slug` (string, required, unique, URL-safe)
- `title` (string, required)
- `description` (string, required)
- `isActive` (boolean, required)
- `tags` (embedded) - array of `{ name }`
- `categoryId` (required) - ObjectId ref Category

### Contact (`contacts`)
- `name`  (string, required)
- `email` (string, required)
- `message` (string, required)
- `postedDate` (Date, required)
- `isRead` (boolean, required, default false)

---

## Minimum Data Requirements
- At least 3 categories
- At least 6 projects
  - Each project belongs to exactly one category
  - Each project has 3+ tags

You can create the initial data using the admin forms:
- `/admin/categories`
- `/admin/projects`

---

## Routes

### Public (HTML)
- `GET /` → home
- `GET /about` → about
- `GET /projects` → project list
  Query params:
  - `?q=term` : search
  - `?tag=tagName` : tag filter
  - `?q=term&tag=tagName` : combined
- `GET /projects/category/:slug` → projects by category slug
- `GET /projects/:slug` → project detail (active-only)
- `GET /contact` → contact form
- `POST /contact` → saves to MongoDB, renders contact-success on success, re-renders contact form on error

### Admin (HTML + JSON actions) - No auth yet
- `GET /admin` → dashboard
- `GET /admin/contacts` → list all contacts
- `PATCH /admin/contacts/:id/read` → toggle read/unread (JSON)
- `DELETE /admin/contacts/:id` → delete contact (JSON)

### Category CRUD
- `GET /admin/categories` → list categories + project reference count (delete disabled if count > 0)
- `GET /admin/categories/new`
- `POST /admin/categories`
- `GET /admin/categories/:id/edit`
- `POST /admin/categories/:id` → update then redirect
- `DELETE /admin/categories/:id` → safe delete (JSON)
  - server refuses deletion if referenced by any projects

### Project CRUD
- `GET /admin/projects` → list projects (shows isActive + tags + category)
- `GET /admin/projects/new`
- `POST /admin/projects`
- `GET /admin/projects/:id/edit`
- `POST /admin/projects/:id` → update then redirect
- `DELETE /admin/projects/:id` → delete (JSON)

Project form supports:
- choosing exactly one category (`categoryId`)
- tags input as CSV -> stored as embedded `{ name }`
- setting `isActive` true/false

---

## API (JSON)

### Projects
- `GET /api/projects` → active projects only
  - supports `?q=` and `?tag=`
- `GET /api/projects/:id` → project detail or JSON 404
- `GET /api/projects/category/:slug` → active projects for category slug

### Categories
- `GET /api/categories` → read-only list of categories

---

## 404 Behavior
- Unknown `/api/*` routes return JSON 404
- Unknown non-api routes render the HTML 404 page

---

## Project Structure

```
/data
  projects.json                                     (optional: kept for reference only)

/public
  /css/styles.css
  /images/...
  /js/main.js
  /js/admin.js                                      (added in A03: for PATCH/DELETE buttons)

/scripts
  import-projects.js                                (optional: one-time import helper)

/src
  /routes
    pages.routes.js                                 (updated in A03: async, Mongo-backed)
    api.routes.js                                   (updated in A03: Mongo-backed + /api/categories)
    admin.routes.js                                 (added in A03: CMS routes)
  /lib
    mongo.js                                        (added in A03: initMongo, dbReady, dbError)
    projects.repository.js                          (updated in A03: uses Mongoose models)
  /models                                           (added in A03: new folder)
    Category.js
    Project.js
    Contact.js

/views
  /layouts
    layout-full.ejs
    layout-sidebar.ejs
  /partials
    nav.ejs
    footer.ejs
    project-card.ejs                                (updated in A03: show category + tags)
    other-projects-list.ejs
  /admin                                            (added in A03: new folder)
    index.ejs
    contacts/index.ejs
    categories/index.ejs
    categories/form.ejs
    projects/index.ejs
    projects/form.ejs
  index.ejs
  about.ejs
  projects.ejs                                      (updated in A03: supports q + tag UI)
  project-details.ejs                               (updated in A03: show category + tags)
  contact.ejs                                       
  contact-success.ejs
  404.ejs
  500.ejs
  db-error.ejs                                      (added in A03: new file)

README.md
ai_interaction_log.txt
package.json                                        (updated in A03: add mongoose/dotenv + scripts)
server.js                                           (updated in A03: init mongo + mount /admin)
.env                                                (added in A03: ignored by git)
.env.example                                        (added in A03: example file for .env)
```

---

## AI Usage Requirement

This repository includes **`ai_interaction_log.txt`** describing which AI tools were used, what they were used for, example prompts, and what was changed afterward.

---

## License & Attribution

This project contains student modifications build on the provided Node2Know starter materials by **Joshua Solomon**, under **Node2Know-LEARN-1.0**.
