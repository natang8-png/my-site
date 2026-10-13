"""Icons for the graphic version of a chapter: one line icon per section number, drawn in the text color of the page.

Each value is the inside of a 24x24 SVG (stroke only). Edit a line here and rebuild the chapter to change an icon.
"""

def svg(body):
    return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
            'stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>')

ICONS = {"harchakot": {i: svg(b) for i, b in {
    # 1 הקדמה: an open book
    1: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    # 2 האיסור הכללי: a shield
    2: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M8.5 12h7"/>',
    # 3 איסור נגיעה: a hand, crossed out
    3: '<path d="M18 11V7a2 2 0 0 0-4 0"/><path d="M14 10V5a2 2 0 0 0-4 0v1"/><path d="M10 10.5V7a2 2 0 0 0-4 0v7"/>'
       '<path d="M18 9a2 2 0 1 1 4 0v5a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/><path d="M3 3l18 18"/>',
    # 4 הרחקות נוספות: keeping a distance
    4: '<path d="M3 12h18"/><path d="M7 8l-4 4 4 4"/><path d="M17 8l4 4-4 4"/><path d="M12 5v2"/><path d="M12 17v2"/>',
    # 5 הנהגת האשה: a clothes hanger (fewer adornments, special clothes for these days)
    5: '<path d="M10 6a2 2 0 1 1 2 2c-.6 0-1 .5-1 1v1.5"/><path d="M11 10.5l-8.2 6.3A1.2 1.2 0 0 0 3.5 19h15a1.2 1.2 0 0 0 .7-2.2z"/>',
    # 6 הסתכלות בה: an eye
    6: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    # 7 מסירת דבר מאחד לשני: passing from one to the other
    7: '<path d="M17 3l4 4-4 4"/><path d="M21 7H3"/><path d="M7 21l-4-4 4-4"/><path d="M3 17h18"/>',
    # 8 אכילה מצלחת אחת: a plate
    8: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
    # 9 אכילה על שולחן אחד: a table
    9: '<path d="M2 8h20"/><path d="M4 8l1-3h14l1 3"/><path d="M5 8v12"/><path d="M19 8v12"/><path d="M5 14h14"/>',
    # 10 שיירי מאכל ומשקה: a cup with some drink left
    10: '<path d="M5 4h14l-1.6 15.2a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8z"/><path d="M6.3 14h11.4"/>',
    # 11 מזיגה והושטה: a wine glass
    11: '<path d="M7 2h10l-.8 6.5a4.2 4.2 0 0 1-8.4 0z"/><path d="M12 13v8"/><path d="M8 21h8"/>',
    # 12 הרחקה בין המיטות: two beds apart
    12: '<path d="M2 20V8"/><path d="M2 13h6v7"/><path d="M2 17h6"/><path d="M22 20V8"/><path d="M22 13h-6v7"/><path d="M22 17h-6"/><path d="M12 5v15" stroke-dasharray="1.5 2.5"/>',
    # 13 ישיבה ושכיבה על מיטת בן הזוג: a bed
    13: '<path d="M2 5v15"/><path d="M2 9h17a3 3 0 0 1 3 3v8"/><path d="M2 16h20"/><path d="M6 9v7"/>',
    # 14 ישיבה על ספסל אחד: a bench
    14: '<path d="M4 6h16"/><path d="M4 10h16"/><path d="M5 6v4"/><path d="M19 6v4"/><path d="M2 14h20"/><path d="M5 14v6"/><path d="M19 14v6"/>',
    # 15 טיול: a walking path
    15: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M7 19h7a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h7"/>',
    # 16 אכילה במסעדה ושהייה במלון: fork and knife
    16: '<path d="M4 2v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M20 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7"/>',
    # 17 ההנהגה בין אנשים: people
    17: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>',
    # 18 מתנה: a gift
    18: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>'
        '<path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    # 19 הצעת המיטה לבן הזוג: a pillow
    19: '<path d="M3 9c0-2.2 1.8-3.5 4-3.5h10c2.2 0 4 1.3 4 3.5v6c0 2.2-1.8 3.5-4 3.5H7c-2.2 0-4-1.3-4-3.5z"/><path d="M7 5.5c1 2 1 11 0 13"/><path d="M17 5.5c-1 2-1 11 0 13"/>',
    # 20 יציקת מים: a drop of water
    20: '<path d="M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z"/><path d="M9 14a3 3 0 0 0 3 3"/>',
    # 21 כשאחד מבני הזוג חולה: a thermometer
    21: '<path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/><path d="M12 11v6"/>',
    # 22 הליכת האשה לבית-הקברות או להלוויה: a gravestone
    22: '<path d="M6 21V9a6 6 0 0 1 12 0v12"/><path d="M3 21h18"/><path d="M10 11h4"/><path d="M10 14.5h4"/>',
    # 23 הליכת האשה לבית-הכנסת: a synagogue
    23: '<path d="M3 21h18"/><path d="M5 21V10l7-6 7 6v11"/><path d="M10 21v-5a2 2 0 0 1 4 0v5"/><path d="M12 7.5l1.3 2.2h-2.6z"/>',
    # 24 חיוב האשה בתפילות וברכות: a Star of David
    24: '<path d="M12 2.5l8.2 14.2H3.8z"/><path d="M12 21.5L3.8 7.3h16.4z"/>',
    # 25 ההנהגה ביום הכיפורים ובתשעה באב: a calendar
    25: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 15h2"/><path d="M14 15h2"/>',
}.items()}}
