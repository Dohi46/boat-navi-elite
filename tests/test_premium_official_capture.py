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

    def test_start_exhibition_and_explicit_wind_direction(self):
        rows = "".join(
            f"<tr><td>選手{i}</td><td>52.0kg</td><td>6.{70+i:02d}</td><td>-0.5</td></tr>"
            for i in range(6))
        start = " ".join(f"{i} Image .{i:02d}" for i in range(1, 7))
        html = ("<html><body>" + rows + "<h2>スタート展示</h2>"
                "<p>コース 並び ST " + start + "</p>"
                "<h2>水面気象情報</h2>"
                "<p>気温 23℃ 風速 3m 水温 24℃ 波高 2cm 風向 90度</p></body></html>")
        weather, exhibition = parse_conditions(html, "2026-11-18T05:00:00+00:00")
        self.assertEqual(weather["wind_direction_deg"], 90)
        self.assertEqual(exhibition["lanes"][0]["start_timing"], .01)
        self.assertEqual(exhibition["lanes"][5]["start_timing"], .06)
        self.assertEqual(exhibition["entry_course_mapping_status"], "unverified: boat identity not in text")

    def test_previous_race_st_not_used_as_start_exhibition(self):
        rows = "".join(
            f"<tr><td>選手{i}</td><td>52.0kg</td><td>6.{70+i:02d}</td><td>-0.5</td><td>前走 ST .15</td></tr>"
            for i in range(6))
        html = rows + "<h2>スタート展示</h2><p>コース 並び ST</p>"
        _, exhibition = parse_conditions(html, "2026-11-18T05:00:00+00:00")
        self.assertIsNone(exhibition["lanes"][0]["start_timing"])

    def test_missing_data_never_fabricated(self):
        weather, exhibition = parse_conditions("<html><body>直前情報なし</body></html>", "2026-11-18T05:00:00+00:00")
        self.assertIsNone(weather)
        self.assertIsNone(exhibition)

if __name__ == "__main__":
    unittest.main()
