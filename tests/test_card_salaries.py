"""Salary sources used by exterior cards must not depend on legacy columns."""
import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build import card_salary_html
class CardSalaryTests(unittest.TestCase):
 def test_single_shift_26_only(self):
  html=card_salary_html({'الورديات':'8 ساعات | 26 يوم: 8000 ج'})
  self.assertIn('8000 ج',html);self.assertIn('26 يوم عمل',html)
 def test_single_shift_both_cycles(self):
  html=card_salary_html({'الورديات':'12 ساعة | 30 يوم: 10500 ج | 26 يوم: 7500 ج'})
  self.assertIn('10500 ج',html);self.assertIn('7500 ج',html)
 def test_multiple_uses_highest_available_not_completed(self):
  html=card_salary_html({'الورديات':'8 ساعات | 30 يوم: 19000 ج | مكتمل\n12 ساعة | 30 يوم: 10.000 ج\n16 ساعة | 30 يوم: 14,100 ج'})
  self.assertIn('14,100',html);self.assertNotIn('19,000',html)
 def test_original_pay_qualifier_preserved(self):
  self.assertIn('بالحافز',card_salary_html({'المرتب':'11000 بالحافز','الورديات':'12 ساعة | 30 يوم: 11000 ج'}))
 def test_daily_not_converted(self):
  html=card_salary_html({'المرتب':'550 ج يوميًا','قبض يومي':'نعم'})
  self.assertIn('550',html);self.assertIn('اليومية',html);self.assertNotIn('في الشهر',html)
 def test_no_invented_pay(self):
  self.assertEqual(card_salary_html({'الورديات':'8 ساعات'}),'')
if __name__=='__main__':unittest.main()
