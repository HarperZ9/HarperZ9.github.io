"""Lesson page specs for A26 Search and sorting and A27 Dynamic programming.

Each spec takes the lesson's facts.json and returns the words the lesson page needs; every
number is read from the facts, none typed here. tools/school/lessons.py renders them.
"""

from __future__ import annotations


def spec_search(f: dict) -> dict:
    rows = f["sorting"]["rows"]
    r1k = next(r for r in rows if r["kind"] == "random" and r["n"] == 1024)
    b = f["search"]["binary"][-1]
    return {
        "id": "A26", "slug": "search", "guide": "Rerun",
        "title": "Search and sorting: the cost of looking",
        "h1": "Search and sorting. <span class=\"g\">The cost of looking.</span>",
        "desc": "Count the comparisons: knocking along a row against halving it, insertion sort against merge sort, and why halving only works on a row in order.",
        "lede": ("Looking things up and putting them in order are two of the commonest jobs a computer does. "
                 "Rerun counts every knock: one shell at a time, halving a sorted row, and two ways to sort it first."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the row of shells",
        "lab": (f"Pick a sort, a kind of row and a size, and watch it sort with every comparison counted; then look for a shell by knocking along or by halving. "
                f"In the film's measurements, a jumbled row of 1,024 took {round(r1k['insertion']['comparisons']['mean']):,} comparisons by insertion and {round(r1k['merge']['comparisons']['mean']):,} by merging; "
                f"halving found any shell among {b['n']:,} in at most {b['bound']} knocks."),
        "lab_btn": "Walk the row", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/search/facts.json")],
        "limits": [
            "Counts of comparisons, not times; real costs also depend on moves, memory and the machine.",
            "The timings in the film are one computer's, with counting switched on.",
            "Every closed form the film uses was checked against the counters at every size; the textbook sections were checked only by their tables of contents.",
        ],
        "next": "Next, on the same beach: <a class=\"inline\" href=\"night-school-editdistance.html\">Dynamic programming</a> (A27).",
    }


def spec_editdistance(f: dict) -> dict:
    k, n = f["pairs"]["rows"][0], f["naive"]["rows"][-1]
    return {
        "id": "A27", "slug": "editdistance", "guide": "Rerun",
        "title": "Dynamic programming: remember what you already worked out",
        "h1": "Dynamic programming. <span class=\"g\">Remember what you already worked out.</span>",
        "desc": "Edit distance two ways: trying every way, with billions of calls, and the table that solves each smaller question once. Plus a shortcut that fails.",
        "lede": ("How many single-letter edits turn one word into another? Rerun tries every way and counts the calls, "
                 "then writes each answer down once in a table, the idea Richard Bellman named dynamic programming."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the tide table",
        "lab": (f"Type two strings and fill the table square by square, then trace the edits back from the corner; or try every way, with every call counted, for strings short enough to finish. "
                f"In the film, kitten and sitting took {k['naiveCallsRun']:,} calls the slow way and {k['cells']} squares in the table; "
                f"at {n['length']} characters, {n['calls']:,} calls against {n['cells']} squares."),
        "lab_btn": "Find the tide table", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/editdistance/facts.json")],
        "limits": [
            "Unit costs: inserting, deleting or changing a letter each costs 1.",
            "Call counts for long strings come from the recursion's own formula, checked against the running counter up to 13 characters.",
            "Wagner and Fischer's paper and Bellman's book were checked by their bibliographic records; the naming date comes from Dreyfus's 2002 account.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-search.html\">Search and sorting</a> (A26).",
    }
