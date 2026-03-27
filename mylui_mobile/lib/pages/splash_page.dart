import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:math' as math;
import '../core/colors.dart';
import '../widgets/app_shell.dart';
import 'login_page.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> with SingleTickerProviderStateMixin {
  late AnimationController _shakeController;
  late Animation<double> _shakeAnim;

  @override
  void initState() {
    super.initState();

    // Animasi "shaking" – bergetar/rotasi halus & realistis
    _shakeController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat();

    _shakeAnim = TweenSequence<double>([
      // Rotate kanan
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 0.05).chain(CurveTween(curve: Curves.easeInOutSine)), weight: 1),
      // Rotate kiri melewati tengah
      TweenSequenceItem(tween: Tween(begin: 0.05, end: -0.04).chain(CurveTween(curve: Curves.easeInOutSine)), weight: 2),
      // Rotate kanan sedikit
      TweenSequenceItem(tween: Tween(begin: -0.04, end: 0.02).chain(CurveTween(curve: Curves.easeInOutSine)), weight: 2),
      // Kembali ke tengah
      TweenSequenceItem(tween: Tween(begin: 0.02, end: 0.0).chain(CurveTween(curve: Curves.easeInOutSine)), weight: 1),
      // Jeda (pause) sebentar sebelum shake lagi
      TweenSequenceItem(tween: ConstantTween(0.0), weight: 6),
    ]).animate(_shakeController);

    _checkAuth();
  }

  Future<void> _checkAuth() async {
    await Future.delayed(const Duration(milliseconds: 2800));
    if (!mounted) return;
    final session = Supabase.instance.client.auth.currentSession;
    if (session != null) {
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const AppShell()));
    } else {
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginPage()));
    }
  }

  @override
  void dispose() {
    _shakeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Logo dengan animasi shaking
            AnimatedBuilder(
              animation: _shakeAnim,
              builder: (context, child) {
                return Transform.rotate(
                  angle: _shakeAnim.value,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(32),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withOpacity(0.2),
                          blurRadius: 30,
                          spreadRadius: 5,
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(28),
                      child: Image.asset('assets/images/logo.png', width: 120, height: 120),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 56),
            Text(
              'MYLUI',
              style: GoogleFonts.outfit(
                fontSize: 30,
                fontWeight: FontWeight.w900,
                letterSpacing: 10,
                color: const Color(0xFF064e3b),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'PREMIUM FINANCIAL PLATFORM',
              style: GoogleFonts.outfit(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 3,
                color: const Color(0xFF064e3b).withValues(alpha: 0.4),
              ),
            ),
            const SizedBox(height: 64),
            // Dot loading indicator yang elegan
            _buildDotLoader(),
          ],
        ),
      ),
    );
  }

  Widget _buildDotLoader() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (i) {
        return AnimatedBuilder(
          animation: _shakeController,
          builder: (context, _) {
            final offset = (i * 0.2);
            final animValue = ((_shakeController.value * 2) + offset) % 1.0;
            final scale = math.sin(animValue * math.pi);
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.3 + (scale * 0.7)),
                shape: BoxShape.circle,
              ),
            );
          },
        );
      }),
    );
  }
}
