"""Repeated factory names on one region page must be tellable apart on the card."""
import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build import mark_duplicate_titles, jtitle, job_id


class DuplicateTitleTests(unittest.TestCase):
    def test_unique_names_untouched(self):
        js = [{'المصنع': 'مصنع سكر', 'الفئة': 'شباب'}, {'المصنع': 'مصنع عصير', 'الفئة': 'شباب'}]
        mark_duplicate_titles(js)
        self.assertEqual([jtitle(j) for j in js], ['مصنع سكر', 'مصنع عصير'])

    def test_same_name_split_by_gender(self):
        js = [{'المصنع': 'مصنع شيبسي', 'الفئة': 'شباب', 'قبض يومي': ''},
              {'المصنع': 'مصنع شيبسي', 'الفئة': 'بنات', 'قبض يومي': ''}]
        mark_duplicate_titles(js)
        self.assertEqual([jtitle(j) for j in js], ['مصنع شيبسي - شباب', 'مصنع شيبسي - بنات'])

    def test_same_gender_split_by_pay_type(self):
        js = [{'المصنع': 'مصنع كرتون', 'الفئة': 'شباب', 'قبض يومي': 'نعم'},
              {'المصنع': 'مصنع كرتون', 'الفئة': 'شباب', 'قبض يومي': ''}]
        mark_duplicate_titles(js)
        self.assertEqual(sorted(jtitle(j) for j in js), ['مصنع كرتون - قبض شهري', 'مصنع كرتون - قبض يومي'])

    def test_same_gender_split_by_housing(self):
        js = [{'المصنع': 'مصنع أ', 'الفئة': 'شباب', 'السكن': 'متوفر ومجهز بالكامل'},
              {'المصنع': 'مصنع أ', 'الفئة': 'شباب', 'السكن': 'غير متوفر'}]
        mark_duplicate_titles(js)
        self.assertEqual(sorted(jtitle(j) for j in js), ['مصنع أ - بدون سكن', 'مصنع أ - سكن متوفر'])

    def test_urls_do_not_change(self):
        j = {'المصنع': 'مصنع شيبسي', 'الفئة': 'بنات'}
        before = job_id(j)
        mark_duplicate_titles([j, {'المصنع': 'مصنع شيبسي', 'الفئة': 'شباب'}])
        self.assertEqual(job_id(j), before)

    def test_marking_twice_is_safe(self):
        js = [{'المصنع': 'مصنع شيبسي', 'الفئة': 'شباب'}, {'المصنع': 'مصنع شيبسي', 'الفئة': 'بنات'}]
        mark_duplicate_titles(js); mark_duplicate_titles(js)
        self.assertEqual([jtitle(j) for j in js], ['مصنع شيبسي - شباب', 'مصنع شيبسي - بنات'])


if __name__ == '__main__':
    unittest.main()
