/**
 * Stats Innotech - Google Apps Script Backend (v2.0)
 * 
 * Supports:
 * 1. Native Apps Script Web App (HtmlService + google.script.run)
 * 2. External REST API via doPost/doGet (for GitHub Pages / static sites via fetch)
 * 3. Contact Form & Internship Application Submissions
 * 4. Google Sheets Database Persistence (Students, Tasks, Submissions, Attendance, Applications, Inquiries, etc.)
 */

const SPREADSHEET_ID = "1dERGNqcGt6ag7VYHWEPNMiK2H7LbaCeMWMhhFX2tIi4";
const SESSION_SECONDS = 21600; // 6 Hours

const ADMIN_ACCOUNTS = {
  "SIT@ADMIN.AYUSHI": "@Ayushi.Stats2026",
  "SIT@ADMIN.TANUSHREE": "@Tanushree.Stats2026",
  "SIT@ADMIN.SUJAL": "@Sujal.Stats2026",
  "SIT@ADMIN.SARVESH": "@Sarvesh.Stats2026",
  "SIT@ADMIN.SHUBHAM": "@Shubham.Stats2026"
};

const SHEETS = {
  Students: ["ID", "Name", "Email", "PasswordHash", "Course", "Batch", "Role", "Status", "CreatedAt"],
  Tasks: ["ID", "Title", "Description", "Date", "Course", "Batch", "StudentEmail", "Deadline", "Status", "CreatedBy", "CreatedAt"],
  Submissions: ["ID", "TaskID", "TaskTitle", "StudentEmail", "Link", "Comments", "Status", "Feedback", "SubmittedAt", "ReviewedAt", "ReviewedBy"],
  Attendance: ["ID", "StudentEmail", "Date", "Status", "MarkedBy", "CreatedAt"],
  Activity: ["ID", "StudentEmail", "Action", "Details", "Timestamp"],
  Announcements: ["ID", "Title", "Message", "Date", "CreatedBy", "CreatedAt"],
  Courses: ["ID", "Name", "Duration", "Description", "CreatedAt"],
  Applications: ["ID", "Name", "Email", "Phone", "Domain", "AcademicYear", "College", "Notes", "Status", "SubmittedAt"],
  Inquiries: ["ID", "Name", "Email", "Phone", "Subject", "Message", "Status", "SubmittedAt"]
};

// ============================================================
// WEB APP & REST API HANDLERS
// ============================================================

/**
 * Serves the HTML Web App when accessed via browser or GET API request
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e.parameter.action, JSON.parse(e.parameter.args || "[]"));
  }
  return HtmlService
    .createHtmlOutputFromFile("Index")
    .setTitle("Stats Innotech - Technical Education & Internships")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handles REST API POST requests from external static sites (e.g. GitHub Pages)
 */
function doPost(e) {
  try {
    let contents = {};
    if (e && e.postData && e.postData.contents) {
      contents = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      contents = e.parameter;
    }
    const action = contents.action || contents.functionName;
    const args = Array.isArray(contents.args) ? contents.args : [contents];
    return handleApiRequest(action, args);
  } catch (err) {
    return createJsonResponse({ ok: false, error: err.message });
  }
}

function handleApiRequest(action, args) {
  try {
    const apiMap = {
      registerStudent: () => registerStudent.apply(null, args),
      login: () => login.apply(null, args),
      adminLogin: () => adminLogin.apply(null, args),
      logout: () => logout.apply(null, args),
      getSession: () => getSession.apply(null, args),
      forgotPassword: () => forgotPassword.apply(null, args),
      changePassword: () => changePassword.apply(null, args),
      getDashboard: () => getDashboard.apply(null, args),
      getStudentTasks: () => getStudentTasks.apply(null, args),
      submitAssignment: () => submitAssignment.apply(null, args),
      submitTask: () => submitAssignment.apply(null, args),
      completeTask: () => completeTask.apply(null, args),
      getMySubmissions: () => getMySubmissions.apply(null, args),
      getStudentSubmissions: () => getMySubmissions.apply(null, args),
      getStudentAttendance: () => getAttendanceForStudent.apply(null, args),
      getStudentAnnouncements: () => getAnnouncements.apply(null, args),
      getStudentActivity: () => getStudentActivity.apply(null, args),
      submitContactForm: () => submitContactForm.apply(null, args),
      submitInternshipApplication: () => submitInternshipApplication.apply(null, args),
      getAdminOverview: () => getAdminStats.apply(null, args),
      getAdminStudents: () => getAdminStudents.apply(null, args),
      getAllSubmissions: () => getAllSubmissions.apply(null, args),
      reviewSubmission: () => reviewSubmission.apply(null, args),
      assignTask: () => assignTask.apply(null, args),
      createAnnouncement: () => createAnnouncement.apply(null, args),
      createCourse: () => createCourse.apply(null, args),
      markAttendance: () => markAttendance.apply(null, args),
      updateStudentStatus: () => updateStudentStatus.apply(null, args),
      getAllActivity: () => getAllActivity.apply(null, args),
      getApplications: () => getApplications.apply(null, args),
      getInquiries: () => getInquiries.apply(null, args)
    };

    if (apiMap[action]) {
      const result = apiMap[action]();
      return createJsonResponse({ ok: true, data: result });
    } else {
      throw new Error("Unknown action: " + action);
    }
  } catch (err) {
    return createJsonResponse({ ok: false, error: err.message });
  }
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// SYSTEM SETUP & INITIAL SEEDING
// ============================================================

function setupSystem() {
  const ss = getSpreadsheet();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]);
    } else if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]);
    }
  });

  // Seed default Demo Student if none exists
  const studentsSheet = ss.getSheetByName("Students");
  if (studentsSheet.getLastRow() <= 1) {
    studentsSheet.appendRow([
      generateId("STU"), "Sujal Kumar", "student@statsinnotech.com",
      hashPassword("student123"), "Java Full Stack", "Batch-2026",
      "Student", "Active", new Date()
    ]);
  }

  // Seed default Courses if none exist
  const coursesSheet = ss.getSheetByName("Courses");
  if (coursesSheet.getLastRow() <= 1) {
    const initialCourses = [
      ["CRS_01", "Java Full Stack", "6 Months", "Spring Boot Microservices & React"],
      ["CRS_02", "Python & Machine Learning", "4 Months", "Data Pipelines, Pandas & ML Models"],
      ["CRS_03", "Cloud Computing (AWS)", "3 Months", "EC2, S3, Docker & CI/CD Pipelines"]
    ];
    initialCourses.forEach(c => coursesSheet.appendRow([...c, new Date()]));
  }

  // Seed default Announcement if none exists
  const annSheet = ss.getSheetByName("Announcements");
  if (annSheet.getLastRow() <= 1) {
    annSheet.appendRow([
      generateId("ANN"), "Welcome to Stats Innotech 2026 Batch!",
      "Your orientation session starts this Monday at 10 AM. Check your portal tasks.",
      new Date(), "Admin", new Date()
    ]);
  }

  return { ok: true, spreadsheetId: SPREADSHEET_ID, sheets: Object.keys(SHEETS) };
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ============================================================
// STUDENT AUTHENTICATION & ACCOUNT MANAGEMENT
// ============================================================

function registerStudent(name, email, password, course) {
  name = String(name || "").trim();
  email = normalizeEmail(email);
  password = String(password || "");
  course = String(course || "").trim() || "Java Full Stack";
  const batch = "Batch-2026";

  if (!name || !email || !password) throw new Error("Name, email and password are required.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");
  if (isAdminId(email) || isAdminId(name)) throw new Error("Admin credentials can only be used in the Admin Login panel.");

  const existing = findStudentByEmail(email);
  if (existing) throw new Error("A student account with this email already exists.");

  const sh = getSpreadsheet().getSheetByName("Students");
  if (!sh) throw new Error("Students sheet is missing. Run setupSystem() once.");

  sh.appendRow([
    generateId("STU"), name, email, hashPassword(password), course, batch,
    "Student", "Active", new Date()
  ]);

  logActivityInternal(email, "Account Created", "Student account created");
  return { ok: true, message: "Account created successfully. You can now log in." };
}

function login(email, password) {
  email = normalizeEmail(email);
  if (isAdminId(email)) throw new Error("Admin credentials are not available in Student Login.");

  const student = findStudentByEmail(email);
  if (!student) throw new Error("Invalid email or password.");
  if (String(student.Status).toLowerCase() !== "active") throw new Error("This student account is inactive.");
  if (student.PasswordHash !== hashPassword(String(password || ""))) throw new Error("Invalid email or password.");

  const session = createSession({
    role: "Student",
    email: email,
    name: student.Name,
    course: student.Course,
    batch: student.Batch
  });
  logActivityInternal(email, "Login", "Student login");
  return session;
}

function changePassword(token, oldPassword, newPassword) {
  const s = requireStudent(token);
  oldPassword = String(oldPassword || "");
  newPassword = String(newPassword || "");

  if (!oldPassword || !newPassword) throw new Error("Both current and new password are required.");
  if (newPassword.length < 6) throw new Error("New password must be at least 6 characters.");

  const student = findStudentByEmail(s.email);
  if (!student) throw new Error("Student account not found.");
  if (student.PasswordHash !== hashPassword(oldPassword)) throw new Error("Current password is incorrect.");

  const sh = getSpreadsheet().getSheetByName("Students");
  sh.getRange(student._row, 4).setValue(hashPassword(newPassword));

  logActivityInternal(s.email, "Password Changed", "Student updated password");
  return { ok: true, message: "Password updated successfully." };
}

function adminLogin(adminId, password) {
  adminId = String(adminId || "").trim().toUpperCase();
  password = String(password || "");
  if (!Object.prototype.hasOwnProperty.call(ADMIN_ACCOUNTS, adminId) ||
      ADMIN_ACCOUNTS[adminId] !== password) {
    throw new Error("Invalid admin ID or password.");
  }
  return createSession({
    role: "Admin",
    adminId: adminId,
    name: adminId.replace("SIT@ADMIN.", "")
  });
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove("SESSION_" + token);
  return { ok: true };
}

function getSession(token) {
  if (!token) return null;
  const raw = CacheService.getScriptCache().get("SESSION_" + token);
  return raw ? JSON.parse(raw) : null;
}

function createSession(data) {
  const token = generateId("SES");
  const session = Object.assign({ token: token, loginAt: new Date().toISOString() }, data);
  CacheService.getScriptCache().put("SESSION_" + token, JSON.stringify(session), SESSION_SECONDS);
  return session;
}

function forgotPassword(email) {
  email = normalizeEmail(email);
  if (isAdminId(email)) throw new Error("Admin credentials cannot be reset through Student Forgot Password.");

  const student = findStudentByEmail(email);
  if (!student) throw new Error("No student account was found for this email.");

  const tempPassword = generateTemporaryPassword();
  const sh = getSpreadsheet().getSheetByName("Students");
  const row = student._row;
  sh.getRange(row, 4).setValue(hashPassword(tempPassword));

  const subject = "Stats Innotech - Password Reset";
  const body =
    "Hello " + student.Name + ",\n\n" +
    "Your temporary Stats Innotech password is: " + tempPassword + "\n\n" +
    "Please log in and change your password when that option is available.\n\n" +
    "Stats Innotech";

  try {
    MailApp.sendEmail(email, subject, body);
  } catch (e) {
    console.error("MailApp send error:", e);
  }

  logActivityInternal(email, "Password Reset", "Temporary password generated and emailed");
  return { ok: true, message: "A temporary password has been sent to your registered email." };
}

// ============================================================
// STUDENT DASHBOARD & TASKS
// ============================================================

function getDashboard(token) {
  const s = requireStudent(token);
  const tasks = getStudentTasksInternal(s.email);
  const submissions = getMySubmissionsInternal(s.email);
  const announcements = getAnnouncementsInternal();
  const attendance = calculateAttendancePercentage(s.email);
  const completed = tasks.filter(t => String(t.Status).toLowerCase() === "completed").length;

  return {
    session: s,
    stats: {
      tasks: tasks.length,
      completed: completed,
      submissions: submissions.length,
      attendance: attendance
    },
    tasks: tasks,
    submissions: submissions,
    announcements: announcements
  };
}

function getStudentTasks(token) {
  const s = requireStudent(token);
  return getStudentTasksInternal(s.email);
}

function getStudentTasksInternal(email) {
  const rows = sheetObjects("Tasks");
  const student = findStudentByEmail(email) || {};
  return rows.filter(r => {
    const sameStudent = normalizeEmail(r.StudentEmail) === normalizeEmail(email);
    const sameBatch = r.Batch && r.Batch === student.Batch;
    const sameCourse = r.Course && r.Course === student.Course;
    return sameStudent || (!r.StudentEmail && (sameBatch || sameCourse));
  });
}

function completeTask(token, taskId) {
  const s = requireStudent(token);
  const sh = getSpreadsheet().getSheetByName("Tasks");
  const rows = sheetObjects("Tasks");
  const idx = rows.findIndex(r => String(r.ID) === String(taskId));
  if (idx < 0) throw new Error("Task not found.");
  const row = idx + 2;
  const studentEmail = normalizeEmail(sh.getRange(row, 7).getValue());
  const task = rows[idx];
  const allowed = studentEmail === s.email || (!studentEmail && (
    (!task.Batch || task.Batch === s.batch) && (!task.Course || task.Course === s.course)
  ));
  if (!allowed) throw new Error("You are not allowed to update this task.");
  sh.getRange(row, 9).setValue("Completed");
  logActivityInternal(s.email, "Task Completed", String(task.Title || taskId));
  return { ok: true };
}

function submitAssignment(token, taskId, link, comments) {
  const s = requireStudent(token);
  if (!link) throw new Error("Assignment link is required.");

  const tasks = getStudentTasksInternal(s.email);
  const task = tasks.find(t => String(t.ID) === String(taskId));
  if (!task) throw new Error("Task not found or not assigned to you.");

  const sh = getSpreadsheet().getSheetByName("Submissions");
  sh.appendRow([
    generateId("SUB"), task.ID, task.Title, s.email, String(link).trim(),
    String(comments || "").trim(), "Submitted", "", new Date(), "", ""
  ]);
  logActivityInternal(s.email, "Assignment Submitted", String(task.Title || taskId));
  return { ok: true, message: "Task submitted successfully." };
}

function getMySubmissions(token) {
  return getMySubmissionsInternal(requireStudent(token).email);
}

function getMySubmissionsInternal(email) {
  return sheetObjects("Submissions").filter(r => normalizeEmail(r.StudentEmail) === normalizeEmail(email));
}

function getStudentActivity(token) {
  const s = requireStudent(token);
  return sheetObjects("Activity").filter(r => normalizeEmail(r.StudentEmail) === s.email);
}

// ============================================================
// WEBSITE FORM SUBMISSIONS (Contact & Internships)
// ============================================================

/**
 * Handles website Contact Form submissions
 */
function submitContactForm(name, email, phone, subject, message) {
  name = String(name || "").trim();
  email = normalizeEmail(email);
  phone = String(phone || "").trim();
  subject = String(subject || "").trim();
  message = String(message || "").trim();

  if (!name || !email || !message) throw new Error("Name, email, and message are required.");

  const sh = getSpreadsheet().getSheetByName("Inquiries");
  if (sh) {
    sh.appendRow([
      generateId("INQ"), name, email, phone, subject, message, "New", new Date()
    ]);
  }

  // Send confirmation email
  try {
    const mailSubject = "Thank you for contacting Stats Innotech";
    const mailBody = "Hello " + name + ",\n\n" +
      "Thank you for reaching out to Stats Innotech. We have received your inquiry regarding: " + (subject || "General Inquiry") + ".\n\n" +
      "Our technical team will review your message and get back to you shortly.\n\n" +
      "Best regards,\nStats Innotech Team";
    MailApp.sendEmail(email, mailSubject, mailBody);
  } catch (e) {
    console.error("Contact Form email error:", e);
  }

  return { ok: true, message: "Thank you! Your message has been received." };
}

/**
 * Handles website Internship Application submissions
 */
function submitInternshipApplication(name, email, phone, domain, year, college, notes) {
  name = String(name || "").trim();
  email = normalizeEmail(email);
  phone = String(phone || "").trim();
  domain = String(domain || "").trim();
  year = String(year || "").trim();
  college = String(college || "").trim();
  notes = String(notes || "").trim();

  if (!name || !email || !domain) throw new Error("Name, email, and domain preference are required.");

  const sh = getSpreadsheet().getSheetByName("Applications");
  if (sh) {
    sh.appendRow([
      generateId("APP"), name, email, phone, domain, year, college, notes, "Received", new Date()
    ]);
  }

  // Send application confirmation email
  try {
    const mailSubject = "Stats Innotech - Internship Application Received";
    const mailBody = "Hello " + name + ",\n\n" +
      "Thank you for applying for the " + domain + " Internship Track at Stats Innotech!\n\n" +
      "Application Details:\n" +
      "- Domain: " + domain + "\n" +
      "- College: " + (college || "N/A") + "\n" +
      "- Academic Year: " + (year || "N/A") + "\n\n" +
      "Our internship coordinators will review your application and send you the project brief and onboarding instructions.\n\n" +
      "Best regards,\nStats Innotech Internship Desk";
    MailApp.sendEmail(email, mailSubject, mailBody);
  } catch (e) {
    console.error("Internship Application email error:", e);
  }

  return { ok: true, message: "Application submitted successfully! Check your email for confirmation." };
}

// ============================================================
// ADMIN API MANAGEMENT
// ============================================================

function assignTask(token, title, description, date, course, batch, studentEmail, deadline) {
  const admin = requireAdmin(token);
  if (!title) throw new Error("Task title is required.");
  const sh = getSpreadsheet().getSheetByName("Tasks");
  sh.appendRow([
    generateId("TSK"), String(title).trim(), String(description || "").trim(),
    date || new Date(), String(course || "").trim(), String(batch || "").trim(),
    normalizeEmail(studentEmail), deadline || "", "Pending", admin.adminId, new Date()
  ]);
  return { ok: true };
}

function getAllSubmissions(token) {
  requireAdmin(token);
  return sheetObjects("Submissions");
}

function reviewSubmission(token, submissionId, status, feedback) {
  const admin = requireAdmin(token);
  const sh = getSpreadsheet().getSheetByName("Submissions");
  const rows = sheetObjects("Submissions");
  const idx = rows.findIndex(r => String(r.ID) === String(submissionId));
  if (idx < 0) throw new Error("Submission not found.");
  sh.getRange(idx + 2, 7).setValue(String(status || "Reviewed"));
  sh.getRange(idx + 2, 8).setValue(String(feedback || ""));
  sh.getRange(idx + 2, 10).setValue(new Date());
  sh.getRange(idx + 2, 11).setValue(admin.adminId);
  return { ok: true };
}

function createAnnouncement(token, title, message) {
  const admin = requireAdmin(token);
  if (!title || !message) throw new Error("Title and message are required.");
  getSpreadsheet().getSheetByName("Announcements").appendRow([
    generateId("ANN"), String(title).trim(), String(message).trim(),
    new Date(), admin.adminId, new Date()
  ]);
  return { ok: true };
}

function getAnnouncements(token) {
  requireLogin(token);
  return getAnnouncementsInternal();
}

function getAnnouncementsInternal() {
  return sheetObjects("Announcements").sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
}

function createCourse(token, name, duration, description) {
  requireAdmin(token);
  if (!name) throw new Error("Course name is required.");
  getSpreadsheet().getSheetByName("Courses").appendRow([
    generateId("CRS"), String(name).trim(), String(duration || "").trim(),
    String(description || "").trim(), new Date()
  ]);
  return { ok: true };
}

function getCourses(token) {
  requireLogin(token);
  return sheetObjects("Courses");
}

function markAttendance(token, studentEmail, date, status) {
  const admin = requireAdmin(token);
  studentEmail = normalizeEmail(studentEmail);
  if (!findStudentByEmail(studentEmail)) throw new Error("Student not found.");
  getSpreadsheet().getSheetByName("Attendance").appendRow([
    generateId("ATT"), studentEmail, date || new Date(), status || "Present",
    admin.adminId, new Date()
  ]);
  return { ok: true };
}

function getAttendanceRecords(token) {
  requireAdmin(token);
  return sheetObjects("Attendance");
}

function getAttendanceForStudent(token) {
  const s = requireStudent(token);
  return sheetObjects("Attendance").filter(r => normalizeEmail(r.StudentEmail) === s.email);
}

function calculateAttendancePercentage(email) {
  const rows = sheetObjects("Attendance").filter(r => normalizeEmail(r.StudentEmail) === normalizeEmail(email));
  if (!rows.length) return 100;
  const present = rows.filter(r => String(r.Status).toLowerCase() === "present").length;
  return Math.round((present / rows.length) * 100);
}

function getAdminStudents(token) {
  requireAdmin(token);
  return getAdminStudentsInternal();
}

function getAdminStudentsInternal() {
  return sheetObjects("Students").map(r => {
    const x = Object.assign({}, r);
    delete x.PasswordHash;
    return x;
  });
}

function updateStudentStatus(token, email, status) {
  requireAdmin(token);
  const student = findStudentByEmail(email);
  if (!student) throw new Error("Student not found.");
  getSpreadsheet().getSheetByName("Students").getRange(student._row, 8).setValue(status);
  logActivityInternal(normalizeEmail(email), "Status Changed", String(status));
  return { ok: true };
}

function getAdminStats(token) {
  requireAdmin(token);
  return getAdminStatisticsInternal();
}

function getAdminStatisticsInternal() {
  const students = sheetObjects("Students").filter(r => String(r.Role).toLowerCase() === "student");
  const tasks = sheetObjects("Tasks");
  const submissions = sheetObjects("Submissions");
  const attendance = sheetObjects("Attendance");
  const present = attendance.filter(r => String(r.Status).toLowerCase() === "present").length;
  return {
    students: students.length,
    tasks: tasks.length,
    submissions: submissions.length,
    attendance: attendance.length ? Math.round((present / attendance.length) * 100) : 100
  };
}

function getAllActivity(token) {
  requireAdmin(token);
  return sheetObjects("Activity").sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
}

function getApplications(token) {
  requireAdmin(token);
  return sheetObjects("Applications");
}

function getInquiries(token) {
  requireAdmin(token);
  return sheetObjects("Inquiries");
}

// ============================================================
// UTILITIES & HELPERS
// ============================================================

function logActivityInternal(email, action, details) {
  const sh = getSpreadsheet().getSheetByName("Activity");
  if (!sh) return;
  sh.appendRow([generateId("ACT"), normalizeEmail(email), action, details, new Date()]);
}

function requireLogin(token) {
  const s = getSession(token);
  if (!s) throw new Error("Session expired. Please log in again.");
  return s;
}

function requireStudent(token) {
  const s = requireLogin(token);
  if (s.role !== "Student") throw new Error("Student access required.");
  return s;
}

function requireAdmin(token) {
  const s = requireLogin(token);
  if (s.role !== "Admin" || !s.adminId || !Object.prototype.hasOwnProperty.call(ADMIN_ACCOUNTS, s.adminId)) {
    throw new Error("Admin access required.");
  }
  return s;
}

function findStudentByEmail(email) {
  email = normalizeEmail(email);
  const rows = sheetObjects("Students");
  const x = rows.find(r => normalizeEmail(r.Email) === email);
  return x || null;
}

function sheetObjects(name) {
  const sh = getSpreadsheet().getSheetByName(name);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map((row, i) => {
    const o = { _row: i + 2 };
    headers.forEach((h, j) => o[h] = row[j]);
    return o;
  });
}

function hashPassword(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password),
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function generateTemporaryPassword() {
  return Utilities.getUuid().replace(/-/g, "").slice(0, 10) + "Aa!";
}

function generateId(prefix) {
  return prefix + "_" + Utilities.getUuid().replace(/-/g, "").slice(0, 12).toUpperCase();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAdminId(value) {
  return Object.prototype.hasOwnProperty.call(
    ADMIN_ACCOUNTS,
    String(value || "").trim().toUpperCase()
  );
}

function testSpreadsheetConnection() {
  const ss = getSpreadsheet();
  return { ok: true, name: ss.getName(), id: ss.getId() };
}

function checkSystemSheets() {
  const ss = getSpreadsheet();
  return Object.keys(SHEETS).map(name => ({
    name: name, exists: !!ss.getSheetByName(name)
  }));
}
