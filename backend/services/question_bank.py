from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


Difficulty = Literal["Easy", "Medium", "Hard"]
Topic = Literal["Basics", "Conditions", "Loops", "Arrays", "Strings", "Functions", "DSA"]
Language = Literal["Python", "Java", "C", "C++"]
ProblemStatus = Literal["Attempted", "Not Attempted"]
SUPPORTED_LANGUAGES = ("Python", "Java", "C", "C++")
QUESTION_BANK_PATH = Path(__file__).resolve().parent.parent / "question_bank.json"


class QuestionTestCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    input: str
    expected: str


class QuestionRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int = Field(gt=0)
    number: int = Field(gt=0)
    title: str = Field(min_length=1)
    difficulty: Difficulty
    topic: Topic
    marks: int = Field(gt=0)
    status: ProblemStatus
    description: str = Field(min_length=1)
    input: str = Field(min_length=1)
    output: str = Field(min_length=1)
    exampleInput: str
    exampleOutput: str
    constraints: str = Field(min_length=1)
    testCases: list[QuestionTestCase] = Field(min_length=1)
    starterCode: dict[Language, str]

    @model_validator(mode="after")
    def validate_starter_code(self) -> "QuestionRecord":
        missing = set(SUPPORTED_LANGUAGES) - set(self.starterCode)
        if missing:
            raise ValueError(
                f"starterCode is missing supported language entries: {', '.join(sorted(missing))}"
            )
        example_pair_exists = any(
            test_case.input == self.exampleInput
            and test_case.expected == self.exampleOutput
            for test_case in self.testCases
        )
        if not example_pair_exists:
            raise ValueError("exampleInput and exampleOutput must match a question test case")
        return self


class PublicProblem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int = Field(gt=0)
    testCaseCount: int = Field(ge=1)
    number: int = Field(gt=0)
    title: str = Field(min_length=1)
    difficulty: Difficulty
    topic: Topic
    marks: int = Field(gt=0)
    status: ProblemStatus
    description: str = Field(min_length=1)
    input: str = Field(min_length=1)
    output: str = Field(min_length=1)
    exampleInput: str
    exampleOutput: str
    constraints: str = Field(min_length=1)
    testCases: list[QuestionTestCase]
    starterCode: dict[Language, str]


class QuestionBankFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    questions: list[QuestionRecord] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_unique_ids(self) -> "QuestionBankFile":
        seen_ids: set[int] = set()
        duplicates: set[int] = set()
        for question in self.questions:
            if question.id in seen_ids:
                duplicates.add(question.id)
            seen_ids.add(question.id)
        if duplicates:
            duplicate_ids = ", ".join(str(problem_id) for problem_id in sorted(duplicates))
            raise ValueError(f"question IDs must be unique; duplicate IDs: {duplicate_ids}")
        return self


class QuestionBankError(ValueError):
    """A clear error indicating the question bank is missing or invalid."""


def parse_question_bank(data: object) -> QuestionBankFile:
    try:
        return QuestionBankFile.model_validate(data)
    except ValidationError as error:
        details = "; ".join(
            f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}"
            for item in error.errors()
        )
        raise QuestionBankError(f"Question bank data is invalid: {details}") from error


def load_question_bank(path: Path = QUESTION_BANK_PATH) -> QuestionBankFile:
    try:
        with path.open("r", encoding="utf-8") as bank_file:
            raw_data = json.load(bank_file)
    except FileNotFoundError as error:
        raise QuestionBankError(f"Question bank file was not found: {path.name}") from error
    except json.JSONDecodeError as error:
        raise QuestionBankError(
            f"Question bank file contains invalid JSON at line {error.lineno}, column {error.colno}."
        ) from error
    except OSError as error:
        raise QuestionBankError("Question bank file could not be read.") from error

    return parse_question_bank(raw_data)


def to_public_problem(record: QuestionRecord) -> PublicProblem:
    public_fields = record.model_dump(exclude={"testCases", "starterCode"})
    return PublicProblem(
        **public_fields,
        testCaseCount=len(record.testCases),
        testCases=[],
        starterCode={language: "" for language in SUPPORTED_LANGUAGES},
    )
