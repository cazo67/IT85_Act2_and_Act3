"""Seeds the DISPOSABLE demo database using the Lab I application models.

Run with the Lab I virtualenv, cwd = Lab I project, DATABASE_URL pointing at the demo database.
Passwords come from DEMO_*_PASSWORD environment variables; nothing sensitive is written to disk here.
Prints a manifest (ids only, no credentials) as JSON on the last line.
"""

import json
import os
import sys
from datetime import date

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import AcademicTerm, Course, CourseOffering, Enrollment, Grade, Program, Role, Status, Student, User
from app.security import hash_password

FIRST = ["Andrea", "Bryan", "Camille", "Dominic", "Erika", "Francis", "Gabriela", "Harold", "Irene", "Joshua",
         "Katrina", "Lorenzo", "Mariel", "Nathan", "Olivia", "Patrick", "Queenie", "Rafael", "Sofia", "Tristan",
         "Unica", "Victor", "Wendy", "Xavier", "Yvette", "Zachary", "Bianca", "Carlo", "Diane", "Elijah", "Faith"]
LAST = ["Santos", "Garcia", "Mendoza", "Torres", "Flores", "Castillo", "Navarro", "Bautista", "Domingo", "Salazar",
        "Rivera", "Lim", "Tan", "Ocampo", "Pascual", "Valdez", "Aguilar", "Soriano", "Cortez", "Delos Reyes"]


def need(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"{name} is required")
    return value


def main() -> None:
    db = SessionLocal()
    try:
        if (db.scalar(select(func.count()).select_from(User)) or 0) > 0:
            sys.exit("Demo database already seeded; refusing to reseed.")
        users = {
            "admin": User(name="Elena Marquez", email="admin@example.com", password_hash=hash_password(need("DEMO_ADMIN_PASSWORD")), role=Role.ADMIN, status=Status.ACTIVE),
            "staff": User(name="Marco Dizon", email="registrar@example.com", password_hash=hash_password(need("DEMO_ADMIN_PASSWORD")), role=Role.STAFF, status=Status.ACTIVE),
            "instructor": User(name="Daniel Ramos", email="instructor@example.com", password_hash=hash_password(need("DEMO_INSTRUCTOR_PASSWORD")), role=Role.INSTRUCTOR, status=Status.ACTIVE),
            "instructor2": User(name="Lourdes Villanueva", email="instructor2@example.com", password_hash=hash_password(need("DEMO_INSTRUCTOR_PASSWORD")), role=Role.INSTRUCTOR, status=Status.ACTIVE),
            "student": User(name="Maya Reyes", email="student@example.com", password_hash=hash_password(need("DEMO_STUDENT_PASSWORD")), role=Role.STUDENT, status=Status.ACTIVE),
            "student_b": User(name="Paolo Aquino", email="paolo.aquino@example.com", password_hash=hash_password(need("DEMO_STUDENT_PASSWORD")), role=Role.STUDENT, status=Status.ACTIVE),
            "student_c": User(name="Isabel Cruz", email="isabel.cruz@example.com", password_hash=hash_password(need("DEMO_STUDENT_PASSWORD")), role=Role.STUDENT, status=Status.ACTIVE),
        }
        db.add_all(users.values()); db.flush()
        programs = [Program(code="BSIT", name="BS Information Technology", description="Information technology program"),
                    Program(code="BSCS", name="BS Computer Science", description="Computer science program"),
                    Program(code="BSIS", name="BS Information Systems", description="Information systems program")]
        db.add_all(programs); db.flush()

        students = []
        for index in range(42):
            first = FIRST[index % len(FIRST)]
            last = LAST[(index * 7 + index // 5) % len(LAST)]
            students.append(Student(
                student_number=f"2026-{index + 101:05d}", first_name=first, last_name=last,
                email=f"{first.lower()}.{last.lower().replace(' ', '')}{index + 1}@example.com",
                birth_date=date(2003 + index % 5, 1 + index % 12, 1 + index % 27), contact_number=f"0917{index + 1000000:07d}",
                address="Quezon City", program_id=programs[index % 3].id, year_level=(index % 4) + 1,
                status=Status.INACTIVE if index in (9, 23, 37) else Status.ACTIVE))
        db.add_all(students); db.flush()

        courses = [Course(course_code=code, course_title=title, units=units, description=desc) for code, title, units, desc in [
            ("IT101", "Introduction to Computing", 3, "Foundations of computing"),
            ("IT102", "Programming Fundamentals", 3, "Introductory programming"),
            ("IT201", "Data Structures and Algorithms", 3, "Core data structures"),
            ("IT202", "Database Systems", 3, "Relational databases and SQL"),
            ("IS101", "Fundamentals of Information Systems", 3, "Information systems basics")]]
        db.add_all(courses); db.flush()
        term = AcademicTerm(academic_year="2026-2027", semester="First Semester", start_date=date(2026, 8, 3), end_date=date(2026, 12, 18))
        db.add(term); db.flush()
        instructors = [users["instructor"], users["instructor2"]]
        offerings = [CourseOffering(course_id=c.id, academic_term_id=term.id, instructor_id=instructors[i % 2].id, section=f"{c.course_code[:2]}-{chr(65 + i)}",
                                    schedule=["MWF 08:00-09:00", "TTh 09:30-11:00", "MWF 10:00-11:00", "TTh 13:00-14:30", "MWF 14:00-15:00"][i], room=f"Room {201 + i}", capacity=40)
                     for i, c in enumerate(courses)]
        db.add_all(offerings); db.flush()
        enrollments = []
        for s_index, student in enumerate(students[:30]):
            for offset in range(2):
                enrollments.append(Enrollment(student_id=student.id, course_offering_id=offerings[(s_index + offset * 2) % 5].id, enrollment_date=date(2026, 8, 5)))
        db.add_all(enrollments); db.flush()
        for index, enrollment in enumerate(enrollments[:36]):
            db.add(Grade(enrollment_id=enrollment.id, midterm_grade=float(78 + index % 18), final_grade=float(80 + index % 16), remarks="PASSED"))
        db.commit()

        program_bsit = programs[0]
        manifest = {
            "counts": {"students": len(students), "courses": len(courses), "offerings": len(offerings), "enrollments": len(enrollments)},
            "ids": {"admin_user": users["admin"].id, "instructor_user": users["instructor"].id, "student_user": users["student"].id, "program_bsit": program_bsit.id, "term_first": term.id},
            "main_student": {"student_number": "2026-00150", "name": "Maya Reyes", "linked_account": "student@example.com (created unlinked)"},
        }
        print(json.dumps(manifest))
    finally:
        db.close()


if __name__ == "__main__":
    main()
