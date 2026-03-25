# Node A04 — Portfolio Launchpad (Passport Auth + RBAC + Project Image Uploads)

This project continues the A03 Portfolio Launchpad and upgrades it into a role-based portfolio CMS using **Passport.js**, **session-based authentication**, **MongoDB Atlas + Mongoose**, and **project image management**.

---

## Features

### Public site
- Home, About, Projects, Project Details, and Contact pages
- Server-rendered with EJS
- Project list supports search and tag filtering
- Project details page shows:
  - featured image as hero image
  - gallery images below project content

### Authentication
- Local authentication with Passport.js
- Session-based login/logout
- Password hashing with bcrypt
- Registration flow for new users
- Registration requires:
  - email
  - nickname
  - password

### Role-Based Access Control
- `USER`
  - can register, log in, log out, and use public routes
  - cannot access admin routes
- `MODERATOR`
  - can access `/admin`
  - can view contact submissions
  - can toggle contact submissions read/unread
  - cannot delete contacts
  - cannot manage categories, projects, images, or users
- `ADMIN`
  - full access to admin dashboard and admin actions
  - can manage contacts, categories, projects, project images, and users
  - cannot delete their own account

### Admin CMS
- Contacts management
- Categories CRUD
- Projects CRUD
- Project image upload and management
- User management for admins

### Security / Logging
- Insufficient privilege attempts are logged with:
  - timestamp
  - user id / role if known
  - method
  - path
  - required role
  - IP best-effort

---

## Tech Stack
- Node.js
- Express
- EJS
- express-ejs-layouts
- MongoDB Atlas
- Mongoose
- Passport.js
- passport-local
- express-session
- connect-mongo
- bcrypt
- multer
- CSS

---

## Setup

### 1) Install dependencies
```bash
npm install
```

### 2) Create `.env`

Create a `.env` file in the project root:

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

Important: 

- Do not commit `.env`
- `.env` should be ignored by Git
- The credentials for the three extra test users are included in `.env`

### 3) MongoDB Atlas checklist

In MongoDB Atlas:
- Create a cluster
- Create a database user (username/password)
- Add your current IP to the IP Access List (or temporarily allow `0.0.0.0/0` for development)
- Ensure your connection string is correct in `.env`

### 4) Import initial project data
```bash
npm run import-projects
```

This imports `data/projects.json` into MongoDB.

### 5) Seed required users
```bash
npm run seed-users
```

This creates:
- your personal ADMIN
- one test USER
- one test MODERATOR
- one additional test ADMIN

### 6) Run the app
```bash
npm run dev
```

App runs at:

- `http://localhost:3000/`

---

## Data Models (Mongoose)

### User (`users`)
- `email` (string, required, unique)
- `nickname` (string, required)
- `passwordHash` (string, required)
- `role` (string, required)
  - `"USER"`
  - `"MODERATOR"`
  - `"ADMIN"`
- `lastLogin` (Date)

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
- `tagline` (string, optional)
- `stack` (string array, optional)
- `images` (embedded) - image objects
  - `path`
  - `alt`
  - `type`
  - `isFeatured`
- `dates`
  - `created`
  - `updated`

### Contact (`contacts`)
- `name`  (string, required)
- `email` (string, required)
- `message` (string, required)
- `postedDate` (Date, required)
- `isRead` (boolean, required, default false)

---

## Routes

### Authentication
- `GET /auth/login`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/register`
- `POST /auth/register`

Registration creates a normal `USER` account.

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

### Admin

#### MODERATOR + ADMIN
- `GET /admin` → dashboard
- `GET /admin/contacts` → list all contacts
- `PATCH /admin/contacts/:id/read` → toggle read/unread (JSON)

#### ADMIN Only
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

### Project Images
- Upload featured images
- Upload gallery images
- Set featured image
- Delete images

### Users
- `GET /admin/users`
- `GET /admin/users/:id/edit`
- `POST /admin/users/:id`
- `POST /admin/users/:id/delete`

Admins cannot delete their own account.

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

## Image Upload Rules
- Uploaded files are stored on disk in `public/uploads`
- Paths stored in MongoDB are site-root relative

Public image behavior:
- project cards use the featured image as thumbnail
- project detail page uses the featured image as hero image
- remaining images appear in the gallery section

---

## Navbar Behavior

The shared layout navbar includes:
- Login link when logged out
- Register link when logged out
- Logout button when logged in
- Current user nickname when logged in
- Current role label for `MODERATOR` and `ADMIN`
- Admin link for `MODERATOR` and `ADMIN`

---

## Project Structure

```
/data
  projects.json

/public
  /css/styles.css
  /images/...
  /js/main.js
  /js/admin.js
  /uploads

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
    Category.js
    Project.js
    Contact.js
    User.js
  /routes
    pages.routes.js
    api.routes.js
    admin.routes.js
    auth.routes.js
  
/views
  /auth
    login.ejs
    register.ejs
  /layouts
    layout-full.ejs
    layout-sidebar.ejs
  /partials
    nav.ejs
    footer.ejs
    project-card.ejs
    other-projects-list.ejs
  /admin
    index.ejs
    contacts/index.ejs
    categories/index.ejs
    categories/form.ejs
    projects/index.ejs
    projects/form.ejs
    users/index.ejs
    users/form.ejs
  index.ejs
  about.ejs
  projects.ejs
  project-details.ejs
  contact.ejs                                       
  contact-success.ejs
  403.ejs
  404.ejs
  500.ejs
  db-error.ejs

README.md
package.json
server.js
.env
.env.example
```

---

## License & Attribution

This project contains student modifications built on the provided Node2Know starter materials by **Joshua Solomon**, under **Node2Know-LEARN-1.0**.
