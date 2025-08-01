import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Rate Limiter Dashboard',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
      ),
      home: const DashboardPage(),
    );
  }
}

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  List<dynamic> trafficLogs = [];
  List<dynamic> blockedRequests = [];
  Map<String, dynamic> rateLimits = {};
  Map<String, dynamic> anomalies = {};
  bool loading = true;
  late WebSocketChannel channel;

  Future<void> fetchData() async {
    setState(() { loading = true; });
    final limitsRes = await http.get(Uri.parse('http://localhost:5000/limits'));
    // final blockedRes = await http.get(Uri.parse('http://localhost:5000/blocked'));
    // final logsRes = await http.get(Uri.parse('http://localhost:5000/logs'));
    // final anomaliesRes = await http.get(Uri.parse('http://localhost:5000/anomalies'));
    setState(() {
      rateLimits = json.decode(limitsRes.body);
      // blockedRequests = json.decode(blockedRes.body)['blockedRequests'];
      // trafficLogs = json.decode(logsRes.body)['requestLogs'];
      // anomalies = anomaliesRes.statusCode == 200 ? json.decode(anomaliesRes.body) : {};
      loading = false;
    });
  }

  @override
  void initState() {
    super.initState();
    fetchData();
    channel = WebSocketChannel.connect(Uri.parse('ws://localhost:5000'));
    channel.stream.listen((event) {
      setState(() {
        trafficLogs.add(json.decode(event));
      });
    });
  }

  @override
  void dispose() {
    channel.sink.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Rate Limiter Dashboard')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: fetchData,
              child: ListView(
                children: [
                  ListTile(
                    title: const Text('Current Rate Limits'),
                    subtitle: Text(rateLimits.toString()),
                  ),
                  Divider(),
                  ListTile(
                    title: const Text('Blocked Requests'),
                    subtitle: Text(blockedRequests.isEmpty ? 'None' : blockedRequests.map((r) => r['ip']).join(", ")),
                  ),
                  Divider(),
                  ListTile(
                    title: const Text('Recent Traffic Logs'),
                    subtitle: Text(trafficLogs.isEmpty ? 'None' : trafficLogs.map((l) => l['ip']).join(", ")),
                  ),
                  Divider(),
                  ListTile(
                    title: const Text('Anomalies'),
                    subtitle: Text(anomalies.isEmpty ? 'None' : anomalies.toString()),
                  ),
                ],
              ),
            ),
    );
  }
}
