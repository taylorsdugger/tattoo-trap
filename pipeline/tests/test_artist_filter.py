"""Guardrails for the crawler's artist-vs-junk heuristics.

These cases are drawn from real junk that the crawler ingested before hardening (nav buttons,
service/category pages, blog posts, account pages) plus the real artists it must keep. They
lock in the rule that an individual-artist link is followed only for a plausible *person name*
or a person slug under an artist-hint directory — never an editorial/category/nav page.

Run:  pytest tests/test_artist_filter.py   (no model download needed)
"""

from __future__ import annotations

import pytest

from tattoo_trap.crawl_shops import _is_person_name, _looks_like_artist_link

HOST = "example.com"


# --- person-name classifier -------------------------------------------------------------

REAL_NAMES = [
    "Angel Antonio", "Ben Wahhh", "Beto Munoz", "Brian Kinsler", "Dan McDarrah",
    "Jason Longtin", "John Wayne", "Josh Grable", "Noe Rodriguez", "Saucy Espinosa",
    "Tj Brown", "Anne-Marie O'Neil",
    # ALL-CAPS names: Wix/Squarespace themes commonly render artist names in CSS caps. The label
    # arrives uppercased ("SCOTT␤LOTZ" on athinlinetattoo.com), and must still read as a person.
    "SCOTT LOTZ", "DAN MCDARRAH", "NOE RODRIGUEZ",
]

# Real junk the old `[A-Z][a-zA-Z]+...` regex accepted as "people".
JUNK_LABELS = [
    "VIEW OUR SERVICES", "STYLE GUIDE", "MEET THE TEAM", "JOIN OUR TEAM", "OUR WORK",
    "CUSTOM ART", "SPECIAL FX", "FILM COLLECTION", "ANIME AND MANGA", "NATURE THEMED TATTOO",
    "Read Bio", "New Page", "Tour Dates", "Private Studio", "Create Account", "My Account",
    "Our Work", "See All Tattoos", "See All Piercings", "Portrait Tattoos", "Fine Line Tattoo",
    "Japanese Tattoos", "Pop Culture Tattoos", "Color Realism Tattoo", "Surrealism Tattoos",
    "Tattoo Care Instructions", "artist interviews", "coverup tattoos", "Amanda Shroom Tattoo",
]


@pytest.mark.parametrize("name", REAL_NAMES)
def test_real_names_are_people(name):
    assert _is_person_name(name) is True


@pytest.mark.parametrize("label", JUNK_LABELS)
def test_junk_labels_are_not_people(label):
    assert _is_person_name(label) is False


# --- link-follow decision ---------------------------------------------------------------

@pytest.mark.parametrize(
    "href,label",
    [
        ("https://example.com/team/angel-antonio", "Angel Antonio"),
        ("https://example.com/staff-members/ben-wahhh/", "Ben Wahhh"),
        ("https://example.com/beto-munoz/", "Beto Munoz"),
        ("https://example.com/chicago/tattoo_artists/dan-mcdarrah/", "Dan McDarrah"),
        # person slug under an artist-hint directory, label is a non-name button
        ("https://example.com/artists/jane-doe", "Read Bio"),
        # Wix flat single-segment artist page with an ALL-CAPS name label (the real
        # athinlinetattoo.com/scottlotz case): no hint directory, so the name carries it.
        ("https://example.com/scottlotz", "SCOTT LOTZ"),
        # Mononym artist whose flat slug matches the label (the real artwithatattooed.com/bowser
        # case): single-name handle, recovered because slugify("Bowser") == "bowser".
        ("https://example.com/bowser", "Bowser"),
        ("https://example.com/sailor", "SAILOR"),
    ],
)
def test_follows_real_artist_links(href, label):
    assert _looks_like_artist_link(href, label, HOST) is True


@pytest.mark.parametrize(
    "href,label",
    [
        ("https://example.com/our-services", "VIEW OUR SERVICES"),
        ("https://example.com/what-are-tattoo-styles", "STYLE GUIDE"),
        ("https://example.com/services/portrait-tattoos-chicago", "Portrait Tattoos"),
        ("https://example.com/post/coverup-tattoo-guide-...-the-right-artist", "coverup tattoos"),
        ("https://example.com/post/blackwork-tattoo-artist-chicago-il", "artist interviews"),
        ("https://example.com/team-4", "MEET THE TEAM"),
        ("https://example.com/m/create-account", "Create Account"),
        ("https://example.com/blank", "New Page"),
        ("https://example.com/tour-dates", "Tour Dates"),
        ("https://example.com/gallery", "OUR WORK"),
        ("https://example.com/tattoo-care-instructions/", "Tattoo Care Instructions"),
        ("https://othersite.com/team/real-name", "Real Name"),  # off-host
        # Mononym guards: one-word label only counts when slugify(label) == the single segment.
        ("https://example.com/team-4", "Bowser"),  # slug mismatch → not a corroborated mononym
        ("https://example.com/flash", "Flash"),    # domain word in NON_NAME_WORDS
        ("https://example.com/pages/bowser", "Bowser"),  # multi-segment, not a flat mononym path
    ],
)
def test_rejects_junk_links(href, label):
    assert _looks_like_artist_link(href, label, HOST) is False
