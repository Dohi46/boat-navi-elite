import unittest
from scripts.premium_official_capture import parse_conditions

class OfficialParserTests(unittest.TestCase):
    def test_weather_and_six_exhibition_times(self):
        html = "<html><body>" + "".join(
            f"<tr><td>選手{i}</td><td>52.0kg</td><td>6.{70+i:02d}</td><td>-0.5</td></tr>"
            for i in range(6)
        ) + "<h2>スタート展示</h2><h2>水面気象情報</h2><p>気温 23.0℃ 晴 風速 3m 水温 24.0℃ 波高 2cm</p></body></html>"
        weather, exhibition = parse_conditions(html, "2026-11-18T05:00:00+00:00")
        self.assertEqual(weather["wind_speed_mps"], 3)
        self.assertEqual(weather["wave_height_cm"], 2)
        self.assertIsNone(weather["wind_direction_deg"])
        self.assertEqual(len(exhibition["lanes"]), 6)
        self.assertIsNone(exhibition["lanes"][0]["start_timing"])

    def test_missing_data_never_fabricated(self):
        weather, exhibition = parse_conditions("<html><body>直前情報なし</body></html>", "2026-11-18T05:00:00+00:00")
        self.assertIsNone(weather)
        self.assertIsNone(exhibition)

if __name__ == "__main__":
    unittest.main()
