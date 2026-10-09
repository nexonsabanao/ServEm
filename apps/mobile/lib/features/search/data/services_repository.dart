import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import 'service_listing.dart';

class ServicesRepository {
  const ServicesRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<ServiceListing>> listPublished() async {
    final response = await _apiClient.getJson(
      'services',
      query: const {'limit': '20'},
    );
    final items = response['items'];
    if (items is! List<Object?> || items.length > 50) {
      throw const ApiContractException();
    }
    return items.map(ServiceListing.fromJson).toList(growable: false);
  }
}
